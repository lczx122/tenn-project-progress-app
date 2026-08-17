// Offline-first sync engine.
//
// The device's IndexedDB stays the source of truth for the UI; when online and
// signed in, the whole app state is mirrored to one row in Supabase
// (last-write-wins by timestamp) and photos/uploads are mirrored to Storage.
// Other devices receive changes live via a realtime subscription.
import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './client'
import { getState, replaceState, setOnLocalChange } from '../store'
import { kvGet, kvSet, photoGet, photoPut, fileGet, filePut } from '../db'
import type { AppState } from '../types'

export type SyncStatus = 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'

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
let session: Session | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined
let running = false

// ---- status (subscribable from React) ----
let status: SyncStatus = supabase ? 'signed-out' : 'disabled'
let lastError = ''
const statusListeners = new Set<() => void>()

function setStatus(next: SyncStatus, err = '') {
  status = next
  lastError = err
  statusListeners.forEach((l) => l())
}

export function useSyncStatus(): { status: SyncStatus; error: string; email: string | null } {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb)
      return () => statusListeners.delete(cb)
    },
    () => snapshot,
    () => snapshot,
  )
}
let snapshot: { status: SyncStatus; error: string; email: string | null } = {
  status,
  error: lastError,
  email: null,
}
function refreshSnapshot() {
  snapshot = { status, error: lastError, email: session?.user.email ?? null }
}
statusListeners.add(refreshSnapshot)

const saveMeta = () => kvSet(META_KEY, meta).catch(() => {})
const saveQueue = () => kvSet(QUEUE_KEY, queue).catch(() => {})

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

  const { data } = await supabase.auth.getSession()
  session = data.session
  supabase.auth.onAuthStateChange((_event, s) => {
    const wasSignedIn = !!session
    session = s
    refreshSnapshot()
    if (s && !wasSignedIn) {
      setStatus('syncing')
      void fullSync()
      subscribeRealtime()
    }
    if (!s) setStatus('signed-out')
  })

  window.addEventListener('online', () => void fullSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void fullSync()
  })

  if (session) {
    setStatus('syncing')
    void fullSync()
    subscribeRealtime()
  } else {
    setStatus('signed-out')
  }
}

function schedulePush() {
  if (!supabase || !session) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void fullSync(), 1500)
}

/** Pull-compare-push. Safe to call often; coalesces concurrent invocations. */
async function fullSync(): Promise<void> {
  if (!supabase || !session || running) return
  if (!navigator.onLine) {
    setStatus('offline')
    return
  }
  running = true
  setStatus('syncing')
  try {
    const { data: row, error } = await supabase
      .from('app_state')
      .select('data, updated_at')
      .eq('user_id', session.user.id)
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
        .from('app_state')
        .upsert({ user_id: session.user.id, data: getState(), updated_at: now })
      if (upErr) throw upErr
      meta = { lastSyncedAt: now, dirty: false, localChangedAt: meta.localChangedAt }
    }
    await saveMeta()
    await drainUploadQueue()
    setStatus('synced')
  } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline', e instanceof Error ? e.message : String(e))
  } finally {
    running = false
    // a local change may have landed mid-sync
    if (meta.dirty && navigator.onLine) schedulePush()
  }
}

function subscribeRealtime() {
  if (!supabase || !session) return
  supabase
    .channel('app-state-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: `user_id=eq.${session.user.id}` },
      (payload) => {
        const at = (payload.new as { updated_at?: string })?.updated_at ?? ''
        if (at && at > meta.lastSyncedAt) void fullSync()
      },
    )
    .subscribe()
}

// ------------------------------- binary sync -------------------------------

function objectPath(task: UploadTask): string {
  return `${session!.user.id}/${task.store}/${task.id}`
}

/** Queue a photo/upload blob for mirroring to Supabase Storage. */
export function enqueueUpload(id: string, store: 'photos' | 'files') {
  if (!supabase) return
  queue.push({ id, store })
  saveQueue()
  if (session && navigator.onLine) void drainUploadQueue()
}

let draining = false
async function drainUploadQueue(): Promise<void> {
  if (!supabase || !session || draining) return
  draining = true
  try {
    while (queue.length > 0) {
      const task = queue[0]
      const blob = task.store === 'photos' ? await photoGet(task.id) : await fileGet(task.id)
      if (blob) {
        const { error } = await supabase.storage
          .from('photos')
          .upload(objectPath(task), blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
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
  if (!supabase || !session) return undefined
  try {
    const { data, error } = await supabase.storage.from('photos').download(`${session.user.id}/${store}/${id}`)
    if (error || !data) return undefined
    if (store === 'photos') await photoPut(id, data)
    else await filePut(id, data)
    return data
  } catch {
    return undefined
  }
}

// ------------------------------- auth -------------------------------

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Sync is not configured'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? error.message : null
}

export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  if (!supabase) return { error: 'Sync is not configured', needsConfirm: false }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message, needsConfirm: false }
  return { error: null, needsConfirm: !data.session }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
  setStatus('signed-out')
}

/** Force an immediate sync (the "Sync now" button). */
export function syncNow(): void {
  void fullSync()
}
