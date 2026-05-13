import type { OcrInfoPayload } from '../../services/resultTypes'

type Props = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  payload: OcrInfoPayload | null
  errorMessage: string | null
}

function formatNumber(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toLocaleString('es-MX')
}

function formatPercent(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`
}

function formatSeconds(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}s`
}

function getIndirectShare(payload: OcrInfoPayload): number | null {
  if (typeof payload.porcetaje_anaquel_indirecta === 'number') {
    return payload.porcetaje_anaquel_indirecta
  }
  if (typeof payload.porcentaje_anaquel_indirecta === 'number') {
    return payload.porcentaje_anaquel_indirecta
  }
  return null
}

function formatShelfRowName(value: string): string {
  const match = value.match(/fila\s*(\d+)/i)
  if (match) return `Row ${match[1]}`
  return value.replaceAll('_', ' ')
}

export function OriginalOcrTable({ status, payload, errorMessage }: Props) {
  if (status === 'loading' || status === 'idle') {
    return (
      <section className="kv-panel" aria-label="Provider API response">
        <h3 className="kv-panel-title">Provider API Response</h3>
        <p className="kv-panel-subtitle">
          Standardized fields returned by the OCR provider API.
        </p>
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </section>
    )
  }

  if (status === 'error' || !payload) {
    return (
      <section className="kv-panel" aria-label="Provider API response">
        <h3 className="kv-panel-title">Provider API Response</h3>
        <p className="kv-panel-subtitle">
          Standardized fields returned by the OCR provider API.
        </p>
        <div className="error">
          {errorMessage ?? 'Provider OCR data is not available right now.'}
        </div>
      </section>
    )
  }

  const conteoEntries = payload.conteo_general ? Object.entries(payload.conteo_general) : []
  const acomodoEntries = payload.acomodo_filas ? Object.entries(payload.acomodo_filas) : []
  const preciosEntries = payload.precios ? Object.entries(payload.precios) : []
  const detections = payload.detections ?? null
  const detectedBoxes = Array.isArray(detections?.xyxy) ? detections!.xyxy.length : 0
  const totalTiming = payload.timing && typeof payload.timing.total === 'number' ? payload.timing.total : null
  const indirectShare = getIndirectShare(payload)

  const mainRows: Array<{ label: string; value: string }> = [
    { label: 'Status', value: payload.status_message ?? '—' },
    { label: 'Filename', value: payload.filename ?? '—' },
    { label: 'Total products', value: formatNumber(payload.total_productos) },
    { label: "Hershey's products", value: formatNumber(payload.conteo_gastillo) },
    { label: 'Direct competitor products', value: formatNumber(payload.conteo_competencia_directa) },
    { label: 'Indirect competitor products', value: formatNumber(payload.conteo_competencia_indirecta) },
    { label: "Hershey's shelf share", value: formatPercent(payload.porcentaje_anaquel_castillo) },
    { label: 'Direct competitor shelf share', value: formatPercent(payload.porcentaje_anaquel_directa) },
    { label: 'Indirect competitor shelf share', value: formatPercent(indirectShare) },
    { label: 'Detected boxes', value: formatNumber(detectedBoxes) },
    { label: 'Total processing time', value: formatSeconds(totalTiming) },
  ]

  return (
    <section className="kv-panel" aria-label="Provider API response">
      <h3 className="kv-panel-title">Provider API Response</h3>
      <p className="kv-panel-subtitle">
        Standardized fields returned by the OCR provider API.
      </p>

      <table className="kv-table">
        <tbody>
          {mainRows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {conteoEntries.length > 0 ? (
        <details className="kv-collapse">
          <summary>Product Count ({conteoEntries.length} items)</summary>
          <div className="kv-scroll">
            <table className="kv-table kv-table-striped">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {conteoEntries.map(([name, count]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{formatNumber(count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {acomodoEntries.length > 0 ? (
        <details className="kv-collapse">
          <summary>Shelf Row Layout ({acomodoEntries.length} rows)</summary>
          <div className="kv-scroll">
            {acomodoEntries.map(([rowName, items]) => (
              <div key={rowName} className="kv-subgroup">
                <div className="kv-subgroup-title">{formatShelfRowName(rowName)}</div>
                <table className="kv-table kv-table-striped">
                  <tbody>
                    {Object.entries(items).map(([product, count]) => (
                      <tr key={product}>
                        <th scope="row">{product}</th>
                        <td>{formatNumber(count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {preciosEntries.length > 0 ? (
        <details className="kv-collapse">
          <summary>Pricing ({preciosEntries.length} items)</summary>
          <div className="kv-scroll">
            <table className="kv-table kv-table-striped">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Offer</th>
                </tr>
              </thead>
              <tbody>
                {preciosEntries.map(([name, entry]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{entry?.precio ?? '—'}</td>
                    <td>{entry?.oferta ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {detections && (detectedBoxes > 0 || (detections.confidence?.length ?? 0) > 0) ? (
        <details className="kv-collapse">
          <summary>Detections ({detectedBoxes} boxes)</summary>
          <div className="kv-scroll">
            <table className="kv-table kv-table-striped">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bounding box</th>
                  <th>Confidence</th>
                  <th>Class ID</th>
                </tr>
              </thead>
              <tbody>
                {(detections.xyxy ?? []).slice(0, 200).map((box, idx) => (
                  <tr key={`box-${idx}`}>
                    <td>{idx + 1}</td>
                    <td className="mono">[{box.map((n) => n.toFixed(1)).join(', ')}]</td>
                    <td>
                      {typeof detections.confidence?.[idx] === 'number'
                        ? detections.confidence![idx].toFixed(3)
                        : '—'}
                    </td>
                    <td>{detections.class_id?.[idx] ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  )
}
