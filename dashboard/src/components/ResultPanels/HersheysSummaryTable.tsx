import type { ProcessedResultPayload, ResultSalesData } from '../../services/resultTypes'

type Props = {
  salesData: ResultSalesData | null
  resultsPayload: ProcessedResultPayload | null
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount)
}

function formatPercent(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`
}

function formatNumber(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toLocaleString('es-MX')
}

export function HersheysSummaryTable({ salesData, resultsPayload }: Props) {
  if (!salesData) {
    return (
      <section className="kv-panel" aria-label="Hershey's view">
        <h3 className="kv-panel-title">Hershey&apos;s view</h3>
        <p className="empty">No transformed data is available for this result.</p>
      </section>
    )
  }

  const currency = salesData.pricing.currency
  const ocrInsights = resultsPayload?.ocrInsights ?? null

  const mainRows: Array<{ label: string; value: string }> = [
    { label: 'Brand', value: salesData.product.brand },
    { label: 'Product', value: salesData.product.productName },
    { label: 'SKU', value: salesData.product.sku },
    { label: 'Category', value: salesData.product.category },
    {
      label: 'Suggested price',
      value: formatCurrency(salesData.pricing.suggestedPrice, currency),
    },
    { label: 'Units sold', value: formatNumber(salesData.kpis.unitsSold) },
    {
      label: 'Estimated revenue',
      value: formatCurrency(salesData.kpis.estimatedRevenue, currency),
    },
    { label: 'Estimated margin', value: formatPercent(salesData.kpis.estimatedMarginPct) },
    { label: 'Channel', value: salesData.context.channel },
    { label: 'Region', value: salesData.context.region },
    { label: 'Active stores', value: formatNumber(salesData.context.storeCount) },
    { label: 'Weekly trend', value: formatPercent(salesData.trend.weeklyTrendPct) },
  ]

  return (
    <section className="kv-panel" aria-label="Hershey's view">
      <h3 className="kv-panel-title">Hershey&apos;s view</h3>
      <p className="kv-panel-subtitle">
        Transformed data ready for KPI dashboards (`result.results.sales`).
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

      <details className="kv-collapse">
        <summary>30-day series ({salesData.series30d.length} points)</summary>
        <div className="kv-scroll">
          <table className="kv-table kv-table-striped">
            <thead>
              <tr>
                <th>Date</th>
                <th>Units</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {salesData.series30d.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{formatNumber(point.units)}</td>
                  <td>{formatCurrency(point.revenue, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="kv-collapse">
        <summary>Top stores ({salesData.topStores.length})</summary>
        <div className="kv-scroll">
          <table className="kv-table kv-table-striped">
            <thead>
              <tr>
                <th>Store</th>
                <th>Units</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {salesData.topStores.map((store) => (
                <tr key={store.storeName}>
                  <td>{store.storeName}</td>
                  <td>{formatNumber(store.units)}</td>
                  <td>{formatCurrency(store.revenue, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {ocrInsights ? (
        <details className="kv-collapse">
          <summary>Derived OCR insights</summary>
          <table className="kv-table">
            <tbody>
              <tr>
                <th scope="row">Total products</th>
                <td>{formatNumber(ocrInsights.totalProducts)}</td>
              </tr>
              <tr>
                <th scope="row">Detected boxes</th>
                <td>{formatNumber(ocrInsights.detectedBoxes)}</td>
              </tr>
              <tr>
                <th scope="row">Hershey&apos;s count</th>
                <td>{formatNumber(ocrInsights.hersheysCount)}</td>
              </tr>
              <tr>
                <th scope="row">Hershey&apos;s share</th>
                <td>{formatPercent(ocrInsights.hersheysSharePct)}</td>
              </tr>
              <tr>
                <th scope="row">Direct competition share</th>
                <td>{formatPercent(ocrInsights.directSharePct)}</td>
              </tr>
              <tr>
                <th scope="row">Indirect competition share</th>
                <td>{formatPercent(ocrInsights.indirectSharePct)}</td>
              </tr>
              <tr>
                <th scope="row">Top detected label</th>
                <td>{ocrInsights.topDetectedLabel ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">Processing seconds</th>
                <td>
                  {ocrInsights.processingSeconds !== null
                    ? `${ocrInsights.processingSeconds.toFixed(2)}s`
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </details>
      ) : null}
    </section>
  )
}
