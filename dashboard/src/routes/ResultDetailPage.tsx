import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { getToken } from '../auth/token'
import { getImage, getImageFile, getResult, type ImageItem, type ResultItem } from '../services/api'
import { isSalesData } from '../services/resultAdapter'

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount)
}

export function ResultDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { resultId } = useParams<{ resultId: string }>()

  const token = useMemo(() => getToken(), [])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [result, setResult] = useState<ResultItem | null>(null)
  const [image, setImage] = useState<ImageItem | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const salesData = useMemo(() => {
    const sales = result?.results?.sales
    return isSalesData(sales) ? sales : null
  }, [result])

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    if (!resultId) {
      navigate('/')
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
        setImage(img)

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
        <div className="dash-title">
          <img className="hersheys-logo-header" src="/hersheys-logo.svg" alt="Logo Hershey's" />
          <span>Resultado</span>
        </div>
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

            <section className="sales-panel" aria-label="Datos de ventas">
              <h2 className="panel-title">Datos de ventas</h2>
              {salesData ? (
                <>
                  <div className="sales-grid">
                    <div className="sales-card">
                      <div className="sales-label">Producto</div>
                      <div className="sales-value">{salesData.product.productName}</div>
                      <div className="sales-meta">
                        {salesData.product.brand} | {salesData.product.sku} | {salesData.product.category}
                      </div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Precio sugerido</div>
                      <div className="sales-value">
                        {formatCurrency(salesData.pricing.suggestedPrice, salesData.pricing.currency)}
                      </div>
                      <div className="sales-meta">{salesData.pricing.currency}</div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Unidades vendidas</div>
                      <div className="sales-value">{salesData.kpis.unitsSold.toLocaleString('es-MX')}</div>
                      <div className="sales-meta">Margen: {salesData.kpis.estimatedMarginPct}%</div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Ingreso estimado</div>
                      <div className="sales-value">
                        {formatCurrency(salesData.kpis.estimatedRevenue, salesData.pricing.currency)}
                      </div>
                      <div className="sales-meta">Tendencia semanal: {salesData.trend.weeklyTrendPct}%</div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Contexto comercial</div>
                      <div className="sales-value">
                        {salesData.context.channel} | {salesData.context.region}
                      </div>
                      <div className="sales-meta">Tiendas activas: {salesData.context.storeCount}</div>
                    </div>
                  </div>

                  <div className="sales-split">
                    <div className="sales-block">
                      <h3 className="sales-block-title">Serie de 30 dias</h3>
                      <div className="sales-scroll">
                        {salesData.series30d.map((point) => (
                          <div key={point.date} className="sales-row">
                            <span>{point.date}</span>
                            <span>{point.units} uds</span>
                            <span>{formatCurrency(point.revenue, salesData.pricing.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="sales-block">
                      <h3 className="sales-block-title">Top tiendas</h3>
                      <div className="sales-scroll">
                        {salesData.topStores.map((store) => (
                          <div key={store.storeName} className="sales-row">
                            <span>{store.storeName}</span>
                            <span>{store.units} uds</span>
                            <span>{formatCurrency(store.revenue, salesData.pricing.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty">Sin datos de ventas disponibles.</p>
              )}
            </section>

            <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
              {JSON.stringify(result.results ?? {}, null, 2)}
            </pre>
          </div>
        ) : null}
      </main>
    </div>
  )
}
