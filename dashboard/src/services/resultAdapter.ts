import type { ProcessedResultPayload, ResultItem, ResultListResponse, ResultSalesData, SalesTopStore } from './resultTypes'

const DEFAULT_PRICE = 59.9
const DEFAULT_CURRENCY = 'MXN'
const DEFAULT_MARGIN = 31.5
const DEFAULT_WEEKLY_TREND = 4.2

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toStringSafe(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function hashSeed(seed: string): number {
  let hash = 0
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 31 + seed.charCodeAt(idx)) >>> 0
  }
  return hash
}

function getTopStores(conteoGeneral: unknown, suggestedPrice: number): SalesTopStore[] {
  const fallbackStores: SalesTopStore[] = [
    { storeName: 'Walmart Universidad', units: 180, revenue: round(180 * suggestedPrice) },
    { storeName: 'Soriana Coyoacan', units: 150, revenue: round(150 * suggestedPrice) },
    { storeName: 'Chedraui Selecto', units: 120, revenue: round(120 * suggestedPrice) },
  ]

  if (!isRecord(conteoGeneral)) {
    return fallbackStores
  }

  const mapped = Object.entries(conteoGeneral)
    .map(([name, rawUnits]) => ({ name, units: Math.max(1, Math.round(toNumber(rawUnits) ?? 0)) }))
    .filter((entry) => entry.units > 0)
    .sort((a, b) => b.units - a.units)
    .slice(0, 5)
    .map((entry) => ({
      storeName: entry.name,
      units: entry.units * 10,
      revenue: round(entry.units * 10 * suggestedPrice),
    }))

  if (mapped.length >= 3) {
    return mapped
  }

  const usedNames = new Set(mapped.map((store) => store.storeName))
  const missing = 3 - mapped.length
  const fillers = fallbackStores.filter((store) => !usedNames.has(store.storeName)).slice(0, missing)
  return [...mapped, ...fillers]
}

function buildSeries30d(seed: number, unitsSold: number, suggestedPrice: number): ResultSalesData['series30d'] {
  const dayMs = 24 * 60 * 60 * 1000
  const seriesEndMs = Date.UTC(2026, 0, 1) + (seed % 365) * dayMs
  const baseUnits = Math.max(4, Math.round(unitsSold / 30))
  return Array.from({ length: 30 }).map((_, idx) => {
    const currentMs = seriesEndMs - (29 - idx) * dayMs
    const day = new Date(currentMs)
    const offset = ((seed + idx) % 7) - 3
    const units = Math.max(1, baseUnits + offset)
    return {
      date: day.toISOString().slice(0, 10),
      units,
      revenue: round(units * suggestedPrice),
    }
  })
}

function pickProductName(raw: Record<string, unknown>): string {
  const conteo = raw.conteo_general
  if (isRecord(conteo)) {
    const top = Object.entries(conteo)
      .map(([name, value]) => ({ name, count: toNumber(value) ?? 0 }))
      .sort((a, b) => b.count - a.count)[0]
    const candidate = top?.name?.split('|')[0]?.trim()
    if (candidate) return candidate
  }

  const precios = raw.precios
  if (isRecord(precios)) {
    const firstName = Object.keys(precios)[0]
    if (firstName) return firstName
  }

  return 'Producto Hershey\'s'
}

function buildSku(seedText: string, seed: number): string {
  const token = seedText.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || `M${seed % 1000}`
  return `HSY-${token}-${seed % 1000}`
}

function getSuggestedPrice(raw: Record<string, unknown>): number {
  const precios = raw.precios
  if (!isRecord(precios)) return DEFAULT_PRICE

  for (const priceNode of Object.values(precios)) {
    if (!isRecord(priceNode)) continue
    const price = toNumber(priceNode.precio)
    if (price !== null && price > 0) return round(price)
  }

  return DEFAULT_PRICE
}

function isLikelyExternalPayload(raw: Record<string, unknown>): boolean {
  return [
    'status_message',
    'total_productos',
    'conteo_general',
    'conteo_gastillo',
    'conteo_competencia_directa',
    'conteo_competencia_indirecta',
    'porcentaje_anaquel_castillo',
    'porcetaje_anaquel_indirecta',
    'precios',
    'detections',
  ].some((key) => key in raw)
}

function isSalesSeriesPoint(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.date === 'string' && typeof value.units === 'number' && typeof value.revenue === 'number'
}

function isTopStore(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.storeName === 'string' && typeof value.units === 'number' && typeof value.revenue === 'number'
}

export function isSalesData(value: unknown): value is ResultSalesData {
  if (!isRecord(value)) return false
  if (!isRecord(value.product) || !isRecord(value.pricing) || !isRecord(value.kpis)) return false
  if (!isRecord(value.context) || !isRecord(value.trend)) return false
  if (!Array.isArray(value.series30d) || !Array.isArray(value.topStores)) return false

  return (
    typeof value.product.brand === 'string' &&
    typeof value.product.productName === 'string' &&
    typeof value.product.sku === 'string' &&
    typeof value.product.category === 'string' &&
    typeof value.pricing.currency === 'string' &&
    typeof value.pricing.suggestedPrice === 'number' &&
    typeof value.kpis.unitsSold === 'number' &&
    typeof value.kpis.estimatedRevenue === 'number' &&
    typeof value.kpis.estimatedMarginPct === 'number' &&
    typeof value.context.channel === 'string' &&
    typeof value.context.region === 'string' &&
    typeof value.context.storeCount === 'number' &&
    typeof value.trend.weeklyTrendPct === 'number' &&
    value.series30d.every(isSalesSeriesPoint) &&
    value.topStores.every(isTopStore)
  )
}

function buildSalesFromExternal(raw: Record<string, unknown>, seedText: string): ResultSalesData {
  const seed = hashSeed(seedText)
  const suggestedPrice = getSuggestedPrice(raw)
  const totalProductos = Math.max(1, Math.round(toNumber(raw.total_productos) ?? 18))
  const unitsSold = totalProductos * 70 + (seed % 25)
  const estimatedRevenue = round(unitsSold * suggestedPrice)
  const percentageCastillo = toNumber(raw.porcentaje_anaquel_castillo)
  const topStores = getTopStores(raw.conteo_general, suggestedPrice)
  const detectedStoreCount = Math.max(3, topStores.length + Math.round(toNumber(raw.conteo_competencia_directa) ?? 0))

  return {
    product: {
      brand: 'Hershey\'s',
      productName: pickProductName(raw),
      sku: buildSku(seedText, seed),
      category: 'Chocolate',
    },
    pricing: {
      suggestedPrice,
      currency: DEFAULT_CURRENCY,
    },
    kpis: {
      unitsSold,
      estimatedRevenue,
      estimatedMarginPct: DEFAULT_MARGIN,
    },
    context: {
      channel: 'Autoservicio',
      region: 'Centro',
      storeCount: detectedStoreCount,
    },
    trend: {
      weeklyTrendPct: round(percentageCastillo ?? DEFAULT_WEEKLY_TREND),
    },
    series30d: buildSeries30d(seed, unitsSold, suggestedPrice),
    topStores,
  }
}

function adaptProcessedResultPayload(raw: unknown, seedText: string): ProcessedResultPayload | null {
  if (raw === null) return null
  if (!isRecord(raw)) return null

  const currentSales = raw.sales
  if (isSalesData(currentSales)) {
    return { ...raw, sales: currentSales }
  }

  if (isLikelyExternalPayload(raw)) {
    return {
      ...raw,
      placeholder: typeof raw.placeholder === 'boolean' ? raw.placeholder : true,
      sales: buildSalesFromExternal(raw, seedText),
    }
  }

  return { ...raw }
}

function adaptResultItem(raw: unknown, fallbackId: string): ResultItem {
  if (!isRecord(raw)) {
    return {
      id: fallbackId,
      image_id: 'unknown-image',
      status: 'processed',
      results: null,
      processed_at: null,
    }
  }

  const id = toStringSafe(raw.id) ?? fallbackId
  const imageId = toStringSafe(raw.image_id) ?? toStringSafe(raw.filename) ?? `image-${fallbackId}`
  const status = toStringSafe(raw.status) ?? 'processed'
  const processedAt = toStringSafe(raw.processed_at)

  return {
    id,
    image_id: imageId,
    status,
    results: adaptProcessedResultPayload(raw.results, imageId),
    processed_at: processedAt,
  }
}

export function adaptResult(raw: unknown): ResultItem {
  return adaptResultItem(raw, 'result-unknown')
}

export function adaptResultList(raw: unknown): ResultListResponse {
  if (!isRecord(raw)) return { total: 0, items: [] }

  const items = Array.isArray(raw.items) ? raw.items.map((item, index) => adaptResultItem(item, `result-${index}`)) : []
  const totalValue = toNumber(raw.total)
  const total = totalValue !== null ? Math.max(0, Math.round(totalValue)) : items.length

  return { total, items }
}
