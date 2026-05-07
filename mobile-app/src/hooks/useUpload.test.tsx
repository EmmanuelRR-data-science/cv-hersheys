import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { useUpload } from './useUpload'

vi.mock('../services/api', () => {
  return {
    getAccessToken: vi.fn(async () => 'token'),
    uploadImage: vi.fn(async () => ({
      id: 'img-1',
      status: 'pending',
      message: 'uploaded',
      created_at: new Date().toISOString(),
    })),
  }
})

vi.mock('../services/compression', () => {
  return {
    compressImageToJpeg: vi.fn(async (b: Blob) => b),
  }
})

vi.mock('../services/offlineQueue', () => {
  return {
    enqueueImage: vi.fn(async () => 'q-1'),
    listQueuedImages: vi.fn(async () => []),
    removeQueuedImage: vi.fn(async () => undefined),
  }
})

describe('useUpload', () => {
  test('queues upload when offline', async () => {
    const { result } = renderHook(() => useUpload({ isOnline: false }))
    await act(async () => {
      await result.current.upload({
        blob: new Blob(['x'], { type: 'image/jpeg' }),
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      })
    })
    expect(result.current.state.status).toBe('queued')
  })

  test('uploads successfully when online', async () => {
    const { result } = renderHook(() => useUpload({ isOnline: true }))
    await act(async () => {
      await result.current.upload({
        blob: new Blob(['x'], { type: 'image/jpeg' }),
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      })
    })
    await waitFor(() => {
      expect(result.current.state.status).toBe('success')
    })
  })
})
