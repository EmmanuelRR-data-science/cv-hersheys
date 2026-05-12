import { config } from '../config'
import { adaptResult, adaptResultList } from './resultAdapter'
import type {
  ImageItem,
  OcrInfoPayload,
  OcrInsights,
  ProcessedResultPayload,
  ResultItem,
  ResultListResponse,
  ResultSalesData,
  SalesSeriesPoint,
  SalesTopStore,
} from './resultTypes'

export type MeResponse = {
  username: string
  role: string
}

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type {
  ImageItem,
  OcrInfoPayload,
  OcrInsights,
  ProcessedResultPayload,
  ResultItem,
  ResultListResponse,
  ResultSalesData,
  SalesSeriesPoint,
  SalesTopStore,
}

export async function getMe(params: { token: string }): Promise<MeResponse> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/me`, {
    headers: { Authorization: `Bearer ${params.token}` },
  })
  if (!response.ok) {
    throw new Error(`me failed: ${response.status}`)
  }
  return (await response.json()) as MeResponse
}

export async function login(params: { username: string; password: string }): Promise<TokenResponse> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: params.username, password: params.password }),
  })
  if (!response.ok) {
    throw new Error(`login failed: ${response.status}`)
  }
  return (await response.json()) as TokenResponse
}

export async function listResults(params: {
  token: string
  page: number
  limit: number
}): Promise<ResultListResponse> {
  const url = new URL(`${config.apiBaseUrl}/api/v1/results`)
  url.searchParams.set('page', String(params.page))
  url.searchParams.set('limit', String(params.limit))

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.token}` },
  })
  if (!response.ok) {
    throw new Error(`results failed: ${response.status}`)
  }
  return adaptResultList(await response.json())
}

export async function getResult(params: { token: string; resultId: string }): Promise<ResultItem> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/results/${params.resultId}`, {
    headers: { Authorization: `Bearer ${params.token}` },
  })
  if (!response.ok) {
    throw new Error(`result failed: ${response.status}`)
  }
  return adaptResult(await response.json())
}

export async function getImage(params: { token: string; imageId: string }): Promise<ImageItem> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/images/${params.imageId}`, {
    headers: { Authorization: `Bearer ${params.token}` },
  })
  if (!response.ok) {
    throw new Error(`image failed: ${response.status}`)
  }
  return (await response.json()) as ImageItem
}

export async function getImageFile(params: { token: string; imageId: string }): Promise<Blob> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/images/${params.imageId}/file`, {
    headers: { Authorization: `Bearer ${params.token}` },
  })
  if (!response.ok) {
    throw new Error(`image file failed: ${response.status}`)
  }
  return await response.blob()
}

export async function getAnnotatedImageFile(params: {
  token: string
  imageId: string
}): Promise<Blob> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/v1/images/${params.imageId}/annotated`,
    {
      headers: { Authorization: `Bearer ${params.token}` },
    },
  )
  if (!response.ok) {
    throw new Error(`annotated image failed: ${response.status}`)
  }
  return await response.blob()
}

export async function getImageOcrInfo(params: {
  token: string
  imageId: string
}): Promise<OcrInfoPayload> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/v1/images/${params.imageId}/ocr_info`,
    {
      headers: { Authorization: `Bearer ${params.token}` },
    },
  )
  if (!response.ok) {
    throw new Error(`ocr info failed: ${response.status}`)
  }
  const data = (await response.json()) as unknown
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('ocr info: invalid payload shape')
  }
  return data as OcrInfoPayload
}
