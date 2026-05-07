import { config } from '../config'

export type MeResponse = {
  username: string
  role: string
}

export type ResultItem = {
  id: string
  image_id: string
  status: string
  results?: Record<string, unknown> | null
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

export async function getMe(params: { token: string }): Promise<MeResponse> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/me`, {
    headers: { Authorization: `Bearer ${params.token}` },
  })
  if (!response.ok) {
    throw new Error(`me failed: ${response.status}`)
  }
  return (await response.json()) as MeResponse
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
  return (await response.json()) as ResultListResponse
}

export async function getResult(params: { token: string; resultId: string }): Promise<ResultItem> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/results/${params.resultId}`, {
    headers: { Authorization: `Bearer ${params.token}` },
  })
  if (!response.ok) {
    throw new Error(`result failed: ${response.status}`)
  }
  return (await response.json()) as ResultItem
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
