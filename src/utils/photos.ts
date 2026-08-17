// Camera capture handling: downscale to keep IndexedDB small, store as JPEG blob.
import { useEffect, useState } from 'react'
import { photoGet, photoPut } from '../db'
import { enqueueUpload, fetchRemoteBlob } from '../sync/engine'

const MAX_DIM = 1280

export async function storePhotoFile(file: File): Promise<string> {
  const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  let blob: Blob = file
  try {
    blob = await downscale(file)
  } catch {
    // keep the original if decoding fails
  }
  await photoPut(id, blob)
  enqueueUpload(id, 'photos')
  return id
}

async function downscale(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.78)
  })
}

const urlCache = new Map<string, string>()

export async function getPhotoUrl(id: string): Promise<string | undefined> {
  const cached = urlCache.get(id)
  if (cached) return cached
  // local first; fall back to the sync backend for photos taken on another device
  const blob = (await photoGet(id)) ?? (await fetchRemoteBlob(id, 'photos'))
  if (!blob) return undefined
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export function usePhotoUrl(id: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(id ? urlCache.get(id) : undefined)
  useEffect(() => {
    let alive = true
    if (!id) return
    getPhotoUrl(id).then((u) => {
      if (alive) setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [id])
  return url
}
