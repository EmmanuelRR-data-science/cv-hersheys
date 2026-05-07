import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { getToken } from '../auth/token'
import { getImage, getImageFile, getResult, type ResultItem } from '../services/api'

type ImageMeta = {
  id: string
  original_filename: string
  format: string
  size_bytes: number
  status: string
  created_at: string
}

export function ResultDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { resultId } = useParams<{ resultId: string }>()

  const token = useMemo(() => getToken(), [])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [result, setResult] = useState<ResultItem | null>(null)
  const [image, setImage] = useState<ImageMeta | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    if (!resultId) {
      setStatus('error')
      return
    }

    let cancelled = false
    let urlToRevoke: string | null = null

    const run = async () => {
      setStatus('loading')
      try {
        const r = await getResult({ token, resultId })
        if (cancelled) return
        setResult(r)

        const img = await getImage({ token, imageId: r.image_id })
        if (cancelled) return
        setImage(img as ImageMeta)

        const blob = await getImageFile({ token, imageId: r.image_id })
        if (cancelled) return
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          urlToRevoke = URL.createObjectURL(blob)
          setImageUrl(urlToRevoke)
        }

        setStatus('ready')
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }

    void run()
    return () => {
      cancelled = true
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke)
      }
    }
  }, [navigate, resultId, token])

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-title">Resultado</div>
        <Link className="btn btn-secondary" to={location.search ? `/${location.search}` : '/'}>
          Volver
        </Link>
      </header>

      <main className="dash-main">
        {status === 'loading' ? (
          <div className="panel">
            <div className="panel-title">Cargando...</div>
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : null}

        {status === 'error' ? <div className="error">No se pudo cargar el resultado.</div> : null}

        {status === 'ready' && result ? (
          <div className="panel">
            <div className="panel-title">Detalle</div>
            <div className="table">
              <div className="table-row">
                <div className="mono">{result.id}</div>
                <div className="mono">{result.image_id}</div>
                <div className="pill">{result.status}</div>
              </div>
            </div>

            {imageUrl ? <img src={imageUrl} alt={image?.original_filename ?? 'image'} className="preview-img" /> : null}

            <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
              {JSON.stringify(result.results ?? {}, null, 2)}
            </pre>
          </div>
        ) : null}
      </main>
    </div>
  )
}
