// Minimal promise-based IndexedDB layer.
// Store "kv" holds the serialized app state; "photos" and "files" hold binary blobs
// (camera captures and uploaded drawings) so everything works fully offline.

const DB_NAME = 'reno-tracker'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos')
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const kvGet = <T>(key: string) => tx<T | undefined>('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
export const kvSet = (key: string, value: unknown) => tx('kv', 'readwrite', (s) => s.put(value, key))

export const photoPut = (id: string, blob: Blob) => tx('photos', 'readwrite', (s) => s.put(blob, id))
export const photoGet = (id: string) => tx<Blob | undefined>('photos', 'readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
export const photoDelete = (id: string) => tx('photos', 'readwrite', (s) => s.delete(id))

export const filePut = (id: string, blob: Blob) => tx('files', 'readwrite', (s) => s.put(blob, id))
export const fileGet = (id: string) => tx<Blob | undefined>('files', 'readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
