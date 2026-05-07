export type QueuedImage = {
  id: string
  createdAt: number
  filename: string
  contentType: string
  blob: Blob
}

const DB_NAME = 'hersheys-cv-mobile'
const DB_VERSION = 1
const STORE = 'uploadQueue'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    openDb()
      .then((db) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        Promise.resolve(fn(store))
          .then((result) => {
            if (result instanceof IDBRequest) {
              result.onerror = () => reject(result.error)
              result.onsuccess = () => resolve(result.result)
            } else {
              resolve(result)
            }
          })
          .catch(reject)
          .finally(() => {
            tx.oncomplete = () => db.close()
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
            tx.onabort = () => {
              db.close()
              reject(tx.error)
            }
          })
      })
      .catch(reject)
  })
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function enqueueImage(input: {
  blob: Blob
  filename: string
  contentType: string
}): Promise<string> {
  const id = randomId()
  const item: QueuedImage = {
    id,
    createdAt: Date.now(),
    filename: input.filename,
    contentType: input.contentType,
    blob: input.blob,
  }
  await withStore('readwrite', (store) => store.put(item))
  return id
}

export async function listQueuedImages(): Promise<QueuedImage[]> {
  const items = await withStore<QueuedImage[]>('readonly', (store) => store.getAll())
  return [...items].sort((a, b) => a.createdAt - b.createdAt)
}

export async function removeQueuedImage(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}

export async function clearQueue(): Promise<void> {
  await withStore('readwrite', (store) => store.clear())
}

