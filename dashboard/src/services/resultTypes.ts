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

export type ProcessedResultPayload = {
  placeholder?: boolean
  sales?: ResultSalesData
  [key: string]: unknown
}

export type ResultItem = {
  id: string
  image_id: string
  status: string
  results?: ProcessedResultPayload | null
  processed_at?: string | null
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
