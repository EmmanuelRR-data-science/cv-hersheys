import './App.css'
import { useEffect, useState } from 'react'

import { CameraCapture } from './components/CameraCapture/CameraCapture'
import { ImagePreview } from './components/ImagePreview/ImagePreview'
import { Header } from './components/UI/Header'
import { useOffline } from './hooks/useOffline'
import { useUpload } from './hooks/useUpload'
import { detectHersheysProduct } from './services/hersheysDetection'

type Captured = { blob: Blob; filename: string; contentType: string; detectedHersheys: boolean }

function App() {
  const { isOnline } = useOffline()
  const { state, upload, drainQueue } = useUpload({ isOnline })
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [analyzingCapture, setAnalyzingCapture] = useState(false)

  useEffect(() => {
    if (isOnline) {
      void drainQueue()
    }
  }, [isOnline, drainQueue])

  const busy = state.status === 'uploading' || analyzingCapture

  return (
    <div className="app">
      <Header title="Hershey's CV" subtitle={isOnline ? 'Online' : 'Offline'} />
      <main className="app-main">
        {captured ? (
          <ImagePreview
            blob={captured.blob}
            detectedHersheys={captured.detectedHersheys}
            busy={busy}
            onRetake={() => setCaptured(null)}
            onConfirm={async () => {
              if (!captured.detectedHersheys) return
              await upload(captured)
              setCaptured(null)
            }}
          />
        ) : (
          <CameraCapture
            onCaptured={async (data) => {
              setAnalyzingCapture(true)
              const detectedHersheys = await detectHersheysProduct(data.blob)
              setCaptured({ ...data, detectedHersheys })
              setAnalyzingCapture(false)
            }}
          />
        )}

        <div className="status-card">
          <div className="status-row">
            <div className="status-label">Estado</div>
            <div className="status-value">{state.status}</div>
          </div>
          <div className="status-row">
            <div className="status-label">Progreso</div>
            <div className="status-value">{state.progressPct}%</div>
          </div>
          {state.message ? <div className="status-message">{state.message}</div> : null}
          {analyzingCapture ? <div className="status-message">Analizando producto en la imagen...</div> : null}
        </div>
      </main>
    </div>
  )
}

export default App
