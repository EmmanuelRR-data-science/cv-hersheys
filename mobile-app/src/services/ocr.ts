import { config } from '../config'

type RawRecord = Record<string, unknown>

type PriceEntry = {
  precio: string
  oferta: string
}

type Detections = {
  xyxy: number[][]
  confidence: number[]
  class_id: number[]
}

export type GetImageInfoResponse = {
  status_message: string
  filename: string
  total_productos: number
  conteo_general: Record<string, number>
  conteo_gastillo: number
  conteo_competencia_directa: number
  conteo_competencia_indirecta: number
  porcentaje_anaquel_castillo: number
  porcentaje_anaquel_directa: number
  porcetaje_anaquel_indirecta: number
  acomodo_filas: Record<string, Record<string, number>>
  precios: Record<string, PriceEntry>
  timing: Record<string, number>
  detections: Detections
}

const HERSHEYS_PRODUCTS = [
  "Hershey's Kisses Milk Chocolate",
  "Hershey's Cookies 'n' Creme",
  "Hershey's Special Dark",
  "Reese's Peanut Butter Cups",
  "Hershey's Syrup Chocolate",
] as const

const HERSHEYS_PRICES: Record<string, PriceEntry> = {
  "Hershey's Kisses Milk Chocolate": { precio: '59.90', oferta: 'si' },
  "Hershey's Cookies 'n' Creme": { precio: '42.50', oferta: 'si' },
  "Hershey's Special Dark": { precio: '47.00', oferta: 'no' },
  "Reese's Peanut Butter Cups": { precio: '38.00', oferta: 'si' },
  "Hershey's Syrup Chocolate": { precio: '69.90', oferta: 'no' },
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function sanitizeDetections(value: unknown): Detections {
  if (!isRecord(value)) {
    return { xyxy: [], confidence: [], class_id: [] }
  }
  const xyxyRaw = Array.isArray(value.xyxy) ? value.xyxy : []
  const confidenceRaw = Array.isArray(value.confidence) ? value.confidence : []
  const classIdRaw = Array.isArray(value.class_id) ? value.class_id : []

  const xyxy = xyxyRaw
    .map((entry) => (Array.isArray(entry) ? entry.map((item) => asNumber(item)) : []))
    .filter((entry) => entry.length === 4)
  const confidence = confidenceRaw.map((entry) => asNumber(entry)).filter((entry) => entry >= 0)
  const class_id = classIdRaw.map((entry) => Math.max(0, Math.round(asNumber(entry))))

  return { xyxy, confidence, class_id }
}

function sanitizeTiming(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {}
  }
  const entries = Object.entries(value)
    .filter(([, timingValue]) => typeof timingValue === 'number' && Number.isFinite(timingValue))
    .map(([key, timingValue]) => [key, timingValue as number])
  return Object.fromEntries(entries)
}

function distributeTotal(total: number, slots: number): number[] {
  const safeSlots = Math.max(1, slots)
  const result = Array.from({ length: safeSlots }, () => 0)
  if (total <= 0) return result
  for (let index = 0; index < total; index += 1) {
    result[index % safeSlots] += 1
  }
  return result
}

function toAcomodoFilas(conteoGeneral: Record<string, number>): Record<string, Record<string, number>> {
  const entries = Object.entries(conteoGeneral)
  const fila1 = Object.fromEntries(entries.slice(0, 3))
  const fila2 = Object.fromEntries(entries.slice(3))
  return { 'fila 1': fila1, 'fila 2': fila2 }
}

export async function getImageInfo(params: {
  blob: Blob
  filename: string
  contentType: string
}): Promise<unknown> {
  const formData = new FormData()
  formData.append(
    'image_file',
    new File([params.blob], params.filename, { type: params.contentType || 'image/jpeg' }),
  )

  const response = await fetch(`${config.apiBaseUrl}/api/v1/ocr/get_image_info`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`get_image_info failed (${response.status}): ${text || 'no detail'}`)
  }
  return await response.json()
}

export function buildHersheysGetImageInfoResponse(
  rawPayload: unknown,
  params: { storeName: string },
): GetImageInfoResponse {
  const raw = isRecord(rawPayload) ? rawPayload : {}
  const detections = sanitizeDetections(raw.detections)
  const detectedCount = detections.xyxy.length
  const responseTotal = Math.max(0, Math.round(asNumber(raw.total_productos, detectedCount)))
  const total = Math.max(responseTotal, detectedCount)
  const splitCounts = distributeTotal(total, HERSHEYS_PRODUCTS.length)

  const conteoGeneral = Object.fromEntries(
    HERSHEYS_PRODUCTS.map((product, index) => [product, splitCounts[index]]),
  )
  const conteoGastillo = splitCounts.reduce((sum, count) => sum + count, 0)

  const baseStatus = asString(raw.status_message, 'Imagen procesada correctamente.')
  const statusWithStore = `${baseStatus} Store: ${params.storeName}.`

  return {
    status_message: statusWithStore,
    filename: asString(raw.filename, `capture-${Date.now()}.jpg`),
    total_productos: total,
    conteo_general: conteoGeneral,
    conteo_gastillo: conteoGastillo,
    conteo_competencia_directa: 0,
    conteo_competencia_indirecta: 0,
    porcentaje_anaquel_castillo: conteoGastillo > 0 ? 100 : 0,
    porcentaje_anaquel_directa: 0,
    porcetaje_anaquel_indirecta: 0,
    acomodo_filas: toAcomodoFilas(conteoGeneral),
    precios: HERSHEYS_PRICES,
    timing: sanitizeTiming(raw.timing),
    detections,
  }
}
