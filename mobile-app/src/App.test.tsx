import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import App from './App'
import { uploadImage } from './services/api'
import { compressImageToJpeg } from './services/compression'
import { getImageInfo } from './services/ocr'

vi.mock('./components/CameraCapture/CameraCapture', () => ({
  CameraCapture: () => <div>Camera ready</div>,
}))

vi.mock('./hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true }),
}))

vi.mock('./services/api', () => ({
  uploadImage: vi.fn(),
}))

vi.mock('./services/compression', () => ({
  compressImageToJpeg: vi.fn(async () => new Blob([new Uint8Array(1536)], { type: 'image/jpeg' })),
}))

vi.mock('./services/ocr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/ocr')>()
  return {
    ...actual,
    getImageInfo: vi.fn(),
  }
})

const mockedCompressImageToJpeg = vi.mocked(compressImageToJpeg)
const mockedGetImageInfo = vi.mocked(getImageInfo)
const mockedUploadImage = vi.mocked(uploadImage)

describe('App', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:preview'),
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('shows compact confirmation when a store is selected', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.selectOptions(screen.getByRole('combobox'), 'WMT-UNIV')

    expect(screen.getByText('Store selected')).toBeInTheDocument()
    expect(screen.getByText('Walmart Universidad (WMT-UNIV)')).toBeInTheDocument()
    expect(screen.getByText('You can now capture or upload an image.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upload file/i })).toBeEnabled()
  })

  test('keeps processed response JSON hidden by default', async () => {
    const user = userEvent.setup()
    mockedGetImageInfo.mockResolvedValue({
      status_message: 'Imagen procesada correctamente.',
      filename: 'anaquel.jpg',
      total_productos: 3,
      detections: { xyxy: [], confidence: [], class_id: [] },
    })
    mockedUploadImage.mockResolvedValue({
      id: 'img-123',
      status: 'uploaded',
      message: 'ok',
      created_at: '2026-05-13T00:00:00Z',
    })

    render(<App />)

    await user.selectOptions(screen.getByRole('combobox'), 'WMT-UNIV')
    await user.click(screen.getByRole('button', { name: /Upload file/i }))

    const optimizedBlob = new Blob([new Uint8Array(1536)], { type: 'image/jpeg' })
    Object.defineProperty(optimizedBlob, 'arrayBuffer', {
      value: vi.fn(async () => new ArrayBuffer(1536)),
      configurable: true,
    })
    mockedCompressImageToJpeg.mockResolvedValueOnce(optimizedBlob)

    const file = new File([new Uint8Array(4096)], 'anaquel.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn(async () => new ArrayBuffer(4096)),
      configurable: true,
    })
    await user.upload(screen.getByLabelText('Select image (.jpg or .png)'), file)
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() => {
      expect(screen.getByText(/dashboard id: img-123/i)).toBeInTheDocument()
    })
    expect(mockedCompressImageToJpeg).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        maxBytes: 2.5 * 1024 * 1024,
        maxWidth: 2000,
        maxHeight: 2000,
      }),
    )
    expect(mockedGetImageInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'anaquel.jpg',
        contentType: 'image/jpeg',
        blob: expect.objectContaining({ size: 1536 }),
      }),
    )
    expect(mockedUploadImage).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'anaquel.jpg',
        storeName: 'Walmart Universidad',
        storeCode: 'WMT-UNIV',
        blob: expect.objectContaining({ size: 1536 }),
      }),
    )
    expect(screen.queryByText(/Hershey's response/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/status_message/i)).not.toBeInTheDocument()
  })
})
