export type SalesSeriesPoint = {
  date: string
  units: number
  revenue: number
}

export type SalesTopStore = {
  storeName: string
  units: number
  revenue: number
}

export type ResultSalesData = {
  product: {
    brand: string
    productName: string
    sku: string
    category: string
  }
  pricing: {
    suggestedPrice: number
    currency: string
  }
  kpis: {
    unitsSold: number
    estimatedRevenue: number
    estimatedMarginPct: number
  }
  context: {
    channel: string
    region: string
    storeCount: number
  }
  trend: {
    weeklyTrendPct: number
  }
  series30d: SalesSeriesPoint[]
  topStores: SalesTopStore[]
}

export type OcrInsights = {
  totalProducts: number
  detectedBoxes: number
  hersheysCount: number
  directCompetitionCount: number
  indirectCompetitionCount: number
  hersheysSharePct: number
  directSharePct: number
  indirectSharePct: number
  processingSeconds: number | null
  topDetectedLabel: string | null
}

export type ProcessedResultPayload = {
  placeholder?: boolean
  sales?: ResultSalesData
  ocrInsights?: OcrInsights
  [key: string]: unknown
}

export type ResultItem = {
  id: string
  image_id: string
  status: string
  results?: ProcessedResultPayload | null
  processed_at?: string | null
  uploaded_at?: string | null
}

export type ResultListResponse = {
  total: number
  items: ResultItem[]
}

export type ImageItem = {
  id: string
  original_filename: string
  format: string
  size_bytes: number
  status: string
  created_at: string
}

export type OcrPriceEntry = {
  precio?: string | number
  oferta?: string
}

export type OcrDetections = {
  xyxy?: number[][]
  confidence?: number[]
  class_id?: number[]
}

/**
 * Provider OCR payload returned by `GET /api/v1/images/{id}/ocr_info`.
 *
 * Mirrors `get_image_info` from the external provider. All fields are
 * optional because the provider has been observed to drop or rename
 * keys (e.g. `porcetaje_anaquel_indirecta`). The dashboard renders
 * defensively from this shape and tolerates missing data.
 */
export type OcrInfoPayload = {
  status_message?: string
  filename?: string
  total_productos?: number
  conteo_general?: Record<string, number>
  conteo_gastillo?: number
  conteo_competencia_directa?: number
  conteo_competencia_indirecta?: number
  porcentaje_anaquel_castillo?: number
  porcentaje_anaquel_directa?: number
  porcetaje_anaquel_indirecta?: number
  porcentaje_anaquel_indirecta?: number
  acomodo_filas?: Record<string, Record<string, number>>
  precios?: Record<string, OcrPriceEntry>
  timing?: Record<string, number>
  detections?: OcrDetections
  [key: string]: unknown
}
