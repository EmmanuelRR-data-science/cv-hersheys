import './App.css'
import { useEffect, useState } from 'react'

import { CameraCapture } from './components/CameraCapture/CameraCapture'
import { ImagePreview } from './components/ImagePreview/ImagePreview'
import { Header } from './components/UI/Header'
import { useOffline } from './hooks/useOffline'
import { useUpload } from './hooks/useUpload'

type Captured = { blob: Blob; filename: string; contentType: string }

function App() {
  const { isOnline } = useOffline()
  const { state, upload, drainQueue } = useUpload({ isOnline })
  const [captured, setCaptured] = useState<Captured | null>(null)

  useEffect(() => {
    if (isOnline) {
      void drainQueue()
    }
  }, [isOnline, drainQueue])

  const busy = state.status === 'uploading'

  return (
    <div className="app">
      <Header title="Hershey's CV" subtitle={isOnline ? 'Online' : 'Offline'} />
      <main className="app-main">
        {captured ? (
          <ImagePreview
            blob={captured.blob}
            busy={busy}
            onRetake={() => setCaptured(null)}
            onConfirm={async () => {
              await upload(captured)
              setCaptured(null)
            }}
          />
        ) : (
          <CameraCapture onCaptured={(data) => setCaptured(data)} />
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
        </div>
      </main>
    </div>
  )
}

export default App
