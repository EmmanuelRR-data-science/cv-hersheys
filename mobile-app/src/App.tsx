import './App.css'
import { useMemo, useState } from 'react'

import { CameraCapture } from './components/CameraCapture/CameraCapture'
import { ImagePreview } from './components/ImagePreview/ImagePreview'
import { Button } from './components/UI/Button'
import { Header } from './components/UI/Header'
import { config } from './config'
import { useOffline } from './hooks/useOffline'
import { uploadImage } from './services/api'
import { compressImageToJpeg } from './services/compression'
import { buildHersheysGetImageInfoResponse, getImageInfo, type GetImageInfoResponse } from './services/ocr'

type Captured = { blob: Blob; filename: string; contentType: string }
type InputMode = 'camera' | 'file'

const STORES = [
  { code: 'WMT-UNIV', name: 'Walmart Universidad' },
  { code: 'CHED-SAT', name: 'Chedraui Satelite' },
  { code: 'SORI-MIX', name: 'Soriana Mixcoac' },
  { code: 'AURR-DEL', name: 'Bodega Aurrera Del Valle' },
  { code: 'HEB-LIND', name: 'HEB Lindavista' },
] as const

const SHOW_DEBUG_JSON = false
const OCR_IMAGE_MAX_BYTES = Math.min(config.maxUploadBytes, 2.5 * 1024 * 1024)
const OCR_IMAGE_MAX_DIMENSION = 2000

function toJpegFilename(filename: string): string {
  const trimmed = filename.trim()
  if (!trimmed) return `capture-${Date.now()}.jpg`
  return /\.[^.]+$/.test(trimmed) ? trimmed.replace(/\.[^.]+$/, '.jpg') : `${trimmed}.jpg`
}

function App() {
  const { isOnline } = useOffline()
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [selectedStoreCode, setSelectedStoreCode] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('camera')
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const [result, setResult] = useState<GetImageInfoResponse | null>(null)

  const selectedStore = useMemo(
    () => STORES.find((store) => store.code === selectedStoreCode) ?? null,
    [selectedStoreCode],
  )

  const busy = status === 'processing'
  const canCapture = selectedStore !== null

  return (
    <div className="app">
      <Header title="Hershey's CV" subtitle={isOnline ? 'Online' : 'Offline'} />
      <main className="app-main">
        <section className="status-card">
          <div className="field-label">Store</div>
          <select
            className="store-select"
            value={selectedStoreCode}
            onChange={(event) => {
              setSelectedStoreCode(event.target.value)
              setCaptured(null)
              setResult(null)
              setStatus('idle')
              setMessage('')
            }}
          >
            <option value="">Select a store</option>
            {STORES.map((store) => (
              <option key={store.code} value={store.code}>
                {store.name}
              </option>
            ))}
          </select>
          {selectedStore ? (
            <div className="store-confirmation" aria-live="polite">
              <div className="store-confirmation-mark" aria-hidden="true">
                OK
              </div>
              <div className="store-confirmation-body">
                <div className="store-confirmation-title">Store selected</div>
                <div className="store-confirmation-meta">
                  {selectedStore.name} ({selectedStore.code})
                </div>
                <div className="store-confirmation-help">
                  You can now capture or upload an image.
                </div>
              </div>
            </div>
          ) : null}
          {!canCapture ? (
            <div className="status-message">Select a store first to continue.</div>
          ) : null}
        </section>

        <section className="status-card">
          <div className="field-label">Image source</div>
          <div className="mode-actions">
            <Button
              variant={inputMode === 'camera' ? 'primary' : 'secondary'}
              disabled={!canCapture}
              onClick={() => {
                setInputMode('camera')
                setCaptured(null)
              }}
            >
              Camera
            </Button>
            <Button
              variant={inputMode === 'file' ? 'primary' : 'secondary'}
              disabled={!canCapture}
              onClick={() => {
                setInputMode('file')
                setCaptured(null)
              }}
            >
              Upload file
            </Button>
          </div>
        </section>

        {captured ? (
          <ImagePreview
            blob={captured.blob}
            detectedHersheys={true}
            busy={busy}
            onRetake={() => {
              setCaptured(null)
              setResult(null)
              setStatus('idle')
              setMessage('')
            }}
            onConfirm={async () => {
              if (!selectedStore) {
                setStatus('error')
                setMessage('Select a store before processing.')
                return
              }
              if (!isOnline) {
                setStatus('error')
                setMessage('No connection. Cannot process image.')
                return
              }
              if (captured.blob.size < 1024) {
                setStatus('error')
                setMessage(
                  `Captured image is too small (${captured.blob.size} bytes). Retake or pick another file.`,
                )
                return
              }

              const originalSizeKb = (captured.blob.size / 1024).toFixed(1)
              setStatus('processing')
              setMessage(`Optimizing image for OCR (${originalSizeKb} KB)...`)

              let optimizedBlob: Blob
              try {
                optimizedBlob = await compressImageToJpeg(captured.blob, {
                  maxBytes: OCR_IMAGE_MAX_BYTES,
                  maxWidth: OCR_IMAGE_MAX_DIMENSION,
                  maxHeight: OCR_IMAGE_MAX_DIMENSION,
                  initialQuality: 0.85,
                  minQuality: 0.6,
                })
              } catch {
                setStatus('error')
                setMessage('Could not optimize the selected image. Try another photo.')
                return
              }

              let optimizedBuffer: ArrayBuffer
              try {
                optimizedBuffer = await optimizedBlob.arrayBuffer()
              } catch {
                setStatus('error')
                setMessage('Could not read the optimized image bytes.')
                return
              }
              const optimizedFilename = toJpegFilename(captured.filename)
              const cloneBlob = () => new Blob([optimizedBuffer.slice(0)], { type: 'image/jpeg' })
              const sizeKb = (optimizedBuffer.byteLength / 1024).toFixed(1)

              setMessage(`Processing optimized image with get_image_info (${sizeKb} KB)...`)
              try {
                const raw = await getImageInfo({
                  blob: cloneBlob(),
                  filename: optimizedFilename,
                  contentType: 'image/jpeg',
                })
                const hersheysPayload = buildHersheysGetImageInfoResponse(raw, {
                  storeName: selectedStore.name,
                })
                setResult(hersheysPayload)

                try {
                  const uploaded = await uploadImage({
                    blob: cloneBlob(),
                    filename: optimizedFilename,
                    storeName: selectedStore.name,
                    storeCode: selectedStore.code,
                  })
                  setStatus('success')
                  setMessage(
                    `Processed for ${selectedStore.name} (${sizeKb} KB, dashboard id: ${uploaded.id})`,
                  )
                } catch (uploadError) {
                  setStatus('success')
                  const detail =
                    uploadError instanceof Error ? uploadError.message : 'unknown error'
                  setMessage(
                    `Processed for ${selectedStore.name}. OCR ready, but dashboard upload failed: ${detail}`,
                  )
                }
              } catch (error) {
                setStatus('error')
                setMessage(error instanceof Error ? error.message : 'Image processing failed')
              }
            }}
          />
        ) : (
          <>
            {inputMode === 'camera' ? (
              <CameraCapture
                onCaptured={(data) => {
                  setCaptured(data)
                  setResult(null)
                  setStatus('idle')
                  setMessage('')
                }}
              />
            ) : (
              <div className="status-card">
                <label className="file-input-label" htmlFor="file-upload">
                  Select image (.jpg or .png)
                </label>
                <input
                  id="file-upload"
                  className="file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  disabled={!canCapture}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    setCaptured({
                      blob: file,
                      filename: file.name,
                      contentType: file.type || 'image/jpeg',
                    })
                    setResult(null)
                    setStatus('idle')
                    setMessage('')
                  }}
                />
              </div>
            )}
          </>
        )}

        <div className="status-card">
          <div className="status-row">
            <div className="status-label">Status</div>
            <div className="status-value">{status}</div>
          </div>
          <div className="status-row">
            <div className="status-label">Active store</div>
            <div className="status-value">{selectedStore?.name ?? 'Not selected'}</div>
          </div>
          {message ? <div className="status-message">{message}</div> : null}
        </div>

        {SHOW_DEBUG_JSON && result ? (
          <div className="status-card">
            <div className="field-label">Hershey's response (get_image_info structure)</div>
            <pre className="result-json">{JSON.stringify(result, null, 2)}</pre>
          </div>
        ) : null}
        {!isOnline ? (
          <div className="status-card">
            <div className="status-message">
              This view requires connection to call the get_image_info endpoint.
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
