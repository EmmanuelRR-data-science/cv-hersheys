import { afterEach, describe, expect, test } from 'vitest'

import { clearQueue, enqueueImage, listQueuedImages, removeQueuedImage } from './offlineQueue'

describe('offlineQueue', () => {
  afterEach(async () => {
    await clearQueue()
  })

  test('enqueues and lists images in FIFO order', async () => {
    const id1 = await enqueueImage({
      blob: new Blob(['a'], { type: 'text/plain' }),
      filename: 'a.txt',
      contentType: 'text/plain',
    })
    const id2 = await enqueueImage({
      blob: new Blob(['b'], { type: 'text/plain' }),
      filename: 'b.txt',
      contentType: 'text/plain',
    })

    const items = await listQueuedImages()
    expect(items.map((i) => i.id)).toEqual([id1, id2])
    expect(items[0].filename).toBe('a.txt')
    expect(items[1].filename).toBe('b.txt')
  })

  test('removes an item by id', async () => {
    const id = await enqueueImage({
      blob: new Blob(['x'], { type: 'text/plain' }),
      filename: 'x.txt',
      contentType: 'text/plain',
    })
    await removeQueuedImage(id)
    const items = await listQueuedImages()
    expect(items).toEqual([])
  })
})

