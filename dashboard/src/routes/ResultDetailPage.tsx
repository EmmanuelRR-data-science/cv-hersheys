import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { HersheysSummaryTable } from '../components/ResultPanels/HersheysSummaryTable'
import { OriginalOcrTable } from '../components/ResultPanels/OriginalOcrTable'
import { getToken } from '../auth/token'
import {
  getAnnotatedImageFile,
  getImage,
  getImageFile,
  getImageOcrInfo,
  getResult,
  type ImageItem,
  type OcrInfoPayload,
  type OcrInsights,
  type ResultItem,
} from '../services/api'
import { isSalesData } from '../services/resultAdapter'

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount)
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(date)
}

function isOcrInsights(value: unknown): value is OcrInsights {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.totalProducts === 'number' &&
    typeof candidate.detectedBoxes === 'number' &&
    typeof candidate.hersheysSharePct === 'number'
  )
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
  const [imageLoadError, setImageLoadError] = useState<string | null>(null)
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null)
  const [annotatedStatus, setAnnotatedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [annotatedError, setAnnotatedError] = useState<string | null>(null)
  const [ocrInfo, setOcrInfo] = useState<OcrInfoPayload | null>(null)
  const [ocrInfoStatus, setOcrInfoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [ocrInfoError, setOcrInfoError] = useState<string | null>(null)
  const salesData = useMemo(() => {
    const sales = result?.results?.sales
    return isSalesData(sales) ? sales : null
  }, [result])
  const ocrInsights = useMemo(() => {
    const insights = result?.results?.ocrInsights
    return isOcrInsights(insights) ? insights : null
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
    let annotatedToRevoke: string | null = null

    const loadOriginal = async (imageId: string) => {
      try {
        const blob = await getImageFile({ token, imageId })
        if (cancelled) return
        if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
        if (blob.size < 100) {
          setImageLoadError('Image preview is not available for this result.')
          return
        }
        urlToRevoke = URL.createObjectURL(blob)
        setImageUrl(urlToRevoke)
      } catch {
        if (!cancelled) {
          setImageLoadError('Image preview is not available for this result.')
        }
      }
    }

    const loadAnnotated = async (imageId: string) => {
      setAnnotatedStatus('loading')
      try {
        const blob = await getAnnotatedImageFile({ token, imageId })
        if (cancelled) return
        if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
        if (blob.size < 100) {
          setAnnotatedStatus('error')
          setAnnotatedError('Annotated image is not available.')
          return
        }
        annotatedToRevoke = URL.createObjectURL(blob)
        setAnnotatedUrl(annotatedToRevoke)
        setAnnotatedStatus('ready')
      } catch (err) {
        if (cancelled) return
        const detail = err instanceof Error ? err.message : 'unknown error'
        setAnnotatedStatus('error')
        setAnnotatedError(`Annotated image not available (${detail}).`)
      }
    }

    const loadOcrInfo = async (imageId: string) => {
      setOcrInfoStatus('loading')
      try {
        const payload = await getImageOcrInfo({ token, imageId })
        if (cancelled) return
        setOcrInfo(payload)
        setOcrInfoStatus('ready')
      } catch (err) {
        if (cancelled) return
        const detail = err instanceof Error ? err.message : 'unknown error'
        setOcrInfoStatus('error')
        setOcrInfoError(`Provider OCR data unavailable (${detail}).`)
      }
    }

    const loadMetadata = async (imageId: string) => {
      try {
        const img = await getImage({ token, imageId })
        if (!cancelled) {
          setImage(img)
        }
      } catch {
        // Metadata endpoint failure should not block the rest.
      }
    }

    const run = async () => {
      setStatus('loading')
      setImageLoadError(null)
      setAnnotatedStatus('idle')
      setAnnotatedError(null)
      setAnnotatedUrl(null)
      setOcrInfo(null)
      setOcrInfoStatus('idle')
      setOcrInfoError(null)
      try {
        const r = await getResult({ token, resultId })
        if (cancelled) return
        setResult(r)
        setStatus('ready')

        await Promise.all([
          loadOriginal(r.image_id),
          loadMetadata(r.image_id),
          loadAnnotated(r.image_id),
          loadOcrInfo(r.image_id),
        ])
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
      if (annotatedToRevoke) {
        URL.revokeObjectURL(annotatedToRevoke)
      }
    }
  }, [navigate, resultId, token])

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-title">
          <img className="hersheys-logo-header" src="/hersheys-logo.svg" alt="Logo Hershey's" />
          <span>Result</span>
        </div>
        <Link className="btn btn-secondary" to={location.search ? `/${location.search}` : '/'}>
          Back
        </Link>
      </header>

      <main className="dash-main">
        {status === 'loading' ? (
          <div className="panel">
            <div className="panel-title">Loading...</div>
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : null}

        {status === 'error' ? <div className="error">Could not load result.</div> : null}

        {status === 'ready' && result ? (
          <div className="panel">
            <div className="panel-title">Details</div>
            <div className="table">
              <div className="table-row">
                <div className="mono">{result.id}</div>
                <div className="mono">{result.image_id}</div>
                <div className="pill">{result.status}</div>
              </div>
              <div className="table-row">
                <div className="mono">Uploaded: {formatDateTime(result.uploaded_at ?? image?.created_at)}</div>
                <div className="mono">Processed: {formatDateTime(result.processed_at)}</div>
                <div className="mono">{image?.original_filename ?? 'File unavailable'}</div>
              </div>
            </div>

            <div className="preview-pair">
              <div className="preview-block">
                <div className="preview-caption">Original capture</div>
                {imageUrl && !imageLoadError ? (
                  <img
                    src={imageUrl}
                    alt={image?.original_filename ?? 'uploaded'}
                    className="preview-img"
                    onError={() =>
                      setImageLoadError('Image preview is not available for this result.')
                    }
                  />
                ) : null}
                {!imageUrl && !imageLoadError ? (
                  <p className="empty">Image preview is loading...</p>
                ) : null}
                {imageLoadError ? <div className="error">{imageLoadError}</div> : null}
              </div>

              <div className="preview-block">
                <div className="preview-caption">OCR /predict annotation</div>
                {annotatedStatus === 'loading' ? (
                  <p className="empty">Generating annotated image...</p>
                ) : null}
                {annotatedStatus === 'ready' && annotatedUrl ? (
                  <img
                    src={annotatedUrl}
                    alt="OCR annotated"
                    className="preview-img"
                    onError={() => {
                      setAnnotatedStatus('error')
                      setAnnotatedError('Annotated image failed to load.')
                    }}
                  />
                ) : null}
                {annotatedStatus === 'error' && annotatedError ? (
                  <div className="error">{annotatedError}</div>
                ) : null}
                {annotatedStatus === 'idle' ? (
                  <p className="empty">Waiting for annotated image...</p>
                ) : null}
              </div>
            </div>

            <section className="sales-panel" aria-label="Sales data">
              <h2 className="panel-title">Sales data</h2>
              {salesData ? (
                <>
                  <div className="sales-grid">
                    <div className="sales-card">
                      <div className="sales-label">Product</div>
                      <div className="sales-value">{salesData.product.productName}</div>
                      <div className="sales-meta">
                        {salesData.product.brand} | {salesData.product.sku} | {salesData.product.category}
                      </div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Suggested price</div>
                      <div className="sales-value">
                        {formatCurrency(salesData.pricing.suggestedPrice, salesData.pricing.currency)}
                      </div>
                      <div className="sales-meta">{salesData.pricing.currency}</div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Units sold</div>
                      <div className="sales-value">{salesData.kpis.unitsSold.toLocaleString('es-MX')}</div>
                      <div className="sales-meta">Margin: {salesData.kpis.estimatedMarginPct}%</div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Estimated revenue</div>
                      <div className="sales-value">
                        {formatCurrency(salesData.kpis.estimatedRevenue, salesData.pricing.currency)}
                      </div>
                      <div className="sales-meta">Weekly trend: {salesData.trend.weeklyTrendPct}%</div>
                    </div>
                    <div className="sales-card">
                      <div className="sales-label">Commercial context</div>
                      <div className="sales-value">
                        {salesData.context.channel} | {salesData.context.region}
                      </div>
                      <div className="sales-meta">Active stores: {salesData.context.storeCount}</div>
                    </div>
                  </div>

                  <div className="sales-split">
                    <div className="sales-block">
                      <h3 className="sales-block-title">30-day series</h3>
                      <div className="sales-scroll">
                        {salesData.series30d.map((point) => (
                          <div key={point.date} className="sales-row">
                            <span>{point.date}</span>
                            <span>{point.units} units</span>
                            <span>{formatCurrency(point.revenue, salesData.pricing.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="sales-block">
                      <h3 className="sales-block-title">Top stores</h3>
                      <div className="sales-scroll">
                        {salesData.topStores.map((store) => (
                          <div key={store.storeName} className="sales-row">
                            <span>{store.storeName}</span>
                            <span>{store.units} units</span>
                            <span>{formatCurrency(store.revenue, salesData.pricing.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty">No sales data available.</p>
              )}
            </section>

            {ocrInsights ? (
              <section className="sales-panel" aria-label="OCR metrics">
                <h2 className="panel-title">Combined OCR metrics</h2>
                <div className="sales-grid">
                  <div className="sales-card">
                    <div className="sales-label">Detected products</div>
                    <div className="sales-value">{ocrInsights.totalProducts.toLocaleString('es-MX')}</div>
                    <div className="sales-meta">Detected boxes: {ocrInsights.detectedBoxes}</div>
                  </div>
                  <div className="sales-card">
                    <div className="sales-label">Hershey's presence</div>
                    <div className="sales-value">{ocrInsights.hersheysCount.toLocaleString('es-MX')}</div>
                    <div className="sales-meta">Share: {formatPercent(ocrInsights.hersheysSharePct)}</div>
                  </div>
                  <div className="sales-card">
                    <div className="sales-label">Direct competition</div>
                    <div className="sales-value">
                      {ocrInsights.directCompetitionCount.toLocaleString('es-MX')}
                    </div>
                    <div className="sales-meta">Share: {formatPercent(ocrInsights.directSharePct)}</div>
                  </div>
                  <div className="sales-card">
                    <div className="sales-label">Indirect competition</div>
                    <div className="sales-value">
                      {ocrInsights.indirectCompetitionCount.toLocaleString('es-MX')}
                    </div>
                    <div className="sales-meta">Share: {formatPercent(ocrInsights.indirectSharePct)}</div>
                  </div>
                  <div className="sales-card">
                    <div className="sales-label">Processing time</div>
                    <div className="sales-value">
                      {ocrInsights.processingSeconds !== null
                        ? `${ocrInsights.processingSeconds.toFixed(2)}s`
                        : 'Not available'}
                    </div>
                    <div className="sales-meta">Source: get_image_info</div>
                  </div>
                  <div className="sales-card">
                    <div className="sales-label">Top label</div>
                    <div className="sales-value">{ocrInsights.topDetectedLabel ?? 'Not available'}</div>
                    <div className="sales-meta">Merged with commercial KPIs</div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="kv-pair" aria-label="JSON breakdown">
              <h2 className="panel-title">JSON breakdown</h2>
              <p className="kv-pair-subtitle">
                Left: Hershey&apos;s view, sourced from `processing_results.results`. Right:
                untouched provider payload from the OCR&apos;s `get_image_info`, fetched
                on demand via `/api/v1/images/{'{id}'}/ocr_info`.
              </p>
              <div className="kv-pair-grid">
                <HersheysSummaryTable
                  salesData={salesData}
                  resultsPayload={result.results ?? null}
                />
                <OriginalOcrTable
                  status={ocrInfoStatus}
                  payload={ocrInfo}
                  errorMessage={ocrInfoError}
                />
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
