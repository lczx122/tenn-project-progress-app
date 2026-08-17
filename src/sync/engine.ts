// Login-free, offline-first sync engine.
//
// All devices opening the app share one dataset: the whole app state lives in
// a single Supabase row (last-write-wins by timestamp), photos and uploads in
// Storage. The device's IndexedDB stays the source of truth for the UI; when
// online, changes push automatically and other devices receive them live via
// realtime, plus pull on start / focus / reconnect and a periodic safety pull.
import { useSyncExternalStore } from 'react'
import { supabase } from './client'
import { getState, replaceState, setOnLocalChange } from '../store'
import { kvGet, kvSet, photoGet, photoPut, fileGet, filePut } from '../db'
import type { AppState } from '../types'

export type SyncStatus = 'disabled' | 'syncing' | 'synced' | 'offline' | 'error'

const ROW_ID = 'global'
const PULL_INTERVAL_MS = 60_000

interface SyncMeta {
  /** updated_at of the last state successfully pushed or adopted */
  lastSyncedAt: string
  /** local changes not yet pushed */
  dirty: boolean
  /** timestamp of the newest local change (for conflict resolution) */
  localChangedAt: string
}

interface UploadTask {
  id: string
  store: 'photos' | 'files'
}

const META_KEY = 'sync-meta'
const QUEUE_KEY = 'sync-upload-queue'

let meta: SyncMeta = { lastSyncedAt: '', dirty: false, localChangedAt: '' }
let queue: UploadTask[] = []
let pushTimer: ReturnType<typeof setTimeout> | undefined
let running = false

// ---- status (subscribable from React) ----
let status: SyncStatus = supabase ? 'syncing' : 'disabled'
let lastError = ''
const statusListeners = new Set<() => void>()
let snapshot: { status: SyncStatus; error: string } = { status, error: lastError }

function setStatus(next: SyncStatus, err = '') {
  status = next
  lastError = err
  snapshot = { status, error: lastError }
  statusListeners.forEach((l) => l())
}

export function useSyncStatus(): { status: SyncStatus; error: string } {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb)
      return () => statusListeners.delete(cb)
    },
    () => snapshot,
    () => snapshot,
  )
}

const saveMeta = () => kvSet(META_KEY, meta).catch(() => {})
const saveQueue = () => kvSet(QUEUE_KEY, queue).catch(() => {})

/** Supabase errors are plain objects, not Error instances — surface something readable. */
function errMsg(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
        ? ((e as { message: string }).message)
        : String(e)
  // the one predictable setup error: schema.sql not run yet
  if (/shared_state/.test(raw) && /(does not exist|schema cache)/i.test(raw)) {
    return 'Database not set up yet — run supabase/schema.sql in the Supabase SQL Editor'
  }
  return raw === '[object Object]' ? 'Unknown sync error' : raw
}

// ------------------------------- engine -------------------------------

export async function startSync(): Promise<void> {
  if (!supabase) return
  meta = (await kvGet<SyncMeta>(META_KEY)) ?? meta
  queue = (await kvGet<UploadTask[]>(QUEUE_KEY)) ?? []

  setOnLocalChange(() => {
    meta.dirty = true
    meta.localChangedAt = new Date().toISOString()
    saveMeta()
    schedulePush()
  })

  window.addEventListener('online', () => void fullSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void fullSync()
  })
  setInterval(() => void fullSync(), PULL_INTERVAL_MS)

  void fullSync()
  subscribeRealtime()
}

function schedulePush() {
  if (!supabase) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void fullSync(), 1500)
}

/** Pull-compare-push. Safe to call often; coalesces concurrent invocations. */
async function fullSync(): Promise<void> {
  if (!supabase || running) return
  if (!navigator.onLine) {
    setStatus('offline')
    return
  }
  running = true
  setStatus('syncing')
  try {
    const { data: row, error } = await supabase
      .from('shared_state')
      .select('data, updated_at')
      .eq('id', ROW_ID)
      .maybeSingle()
    if (error) throw error

    const remoteAt = row?.updated_at ?? ''
    const remoteIsNew = remoteAt > meta.lastSyncedAt

    if (row && remoteIsNew && (!meta.dirty || remoteAt > meta.localChangedAt)) {
      // Remote wins: adopt it (LWW). Any older unpushed local edits are superseded.
      replaceState(row.data as AppState)
      meta = { lastSyncedAt: remoteAt, dirty: false, localChangedAt: meta.localChangedAt }
    } else if (meta.dirty || !row) {
      // Local wins (or first push): upload the whole state.
      const now = new Date().toISOString()
      const { error: upErr } = await supabase
        .from('shared_state')
        .upsert({ id: ROW_ID, data: getState(), updated_at: now })
      if (upErr) throw upErr
      meta = { lastSyncedAt: now, dirty: false, localChangedAt: meta.localChangedAt }
    }
    await saveMeta()
    await drainUploadQueue()
    setStatus('synced')
  } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline', errMsg(e))
  } finally {
    running = false
    // a local change may have landed mid-sync
    if (meta.dirty && navigator.onLine) schedulePush()
  }
}

function subscribeRealtime() {
  if (!supabase) return
  supabase
    .channel('shared-state-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shared_state', filter: `id=eq.${ROW_ID}` },
      (payload) => {
        const at = (payload.new as { updated_at?: string })?.updated_at ?? ''
        if (at && at > meta.lastSyncedAt) void fullSync()
      },
    )
    .subscribe()
}

// ------------------------------- binary sync -------------------------------

function objectPath(store: 'photos' | 'files', id: string): string {
  return `shared/${store}/${id}`
}

/** Queue a photo/upload blob for mirroring to Supabase Storage. */
export function enqueueUpload(id: string, store: 'photos' | 'files') {
  if (!supabase) return
  queue.push({ id, store })
  saveQueue()
  if (navigator.onLine) void drainUploadQueue()
}

let draining = false
async function drainUploadQueue(): Promise<void> {
  if (!supabase || draining) return
  draining = true
  try {
    while (queue.length > 0) {
      const task = queue[0]
      const blob = task.store === 'photos' ? await photoGet(task.id) : await fileGet(task.id)
      if (blob) {
        const { error } = await supabase.storage
          .from('photos')
          .upload(objectPath(task.store, task.id), blob, {
            upsert: true,
            contentType: blob.type || 'application/octet-stream',
          })
        if (error && !`${error.message}`.includes('already exists')) throw error
      }
      queue.shift()
      await saveQueue()
    }
  } catch {
    // leave the rest of the queue for the next sync
  } finally {
    draining = false
  }
}

/** Fetch a blob another device uploaded; caches it into IndexedDB. */
export async function fetchRemoteBlob(id: string, store: 'photos' | 'files'): Promise<Blob | undefined> {
  if (!supabase) return undefined
  try {
    const { data, error } = await supabase.storage.from('photos').download(objectPath(store, id))
    if (error || !data) return undefined
    if (store === 'photos') await photoPut(id, data)
    else await filePut(id, data)
    return data
  } catch {
    return undefined
  }
}

/** Force an immediate sync (the "Sync now" button). */
export function syncNow(): void {
  void fullSync()
}
