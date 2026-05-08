import { config } from '../config'
import { decodeJwtPayload } from './jwt'

export type TokenResponse = {
  access_token: string
  token_type: string
}

type StoredAuth = {
  accessToken: string
}

const STORAGE_KEY = 'hersheys_cv_auth'
const CREDENTIALS_KEY = 'hersheys_cv_mobile_credentials'

type StoredCredentials = {
  username: string
  password: string
}

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

function writeStoredAuth(auth: StoredAuth | null): void {
  if (!auth) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

function readStoredCredentials(): StoredCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>
    if (typeof parsed.username !== 'string' || typeof parsed.password !== 'string') return null
    if (!parsed.username.trim() || !parsed.password.trim()) return null
    return { username: parsed.username.trim(), password: parsed.password.trim() }
  } catch {
    return null
  }
}

function writeStoredCredentials(credentials: StoredCredentials): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
}

function promptForCredentials(): StoredCredentials | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null
  const username = window.prompt('Usuario API')?.trim() ?? ''
  const password = window.prompt('Contrasena API')?.trim() ?? ''
  if (!username || !password) return null
  return { username, password }
}

function isTokenFresh(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  const expiresAtMs = payload.exp * 1000
  return expiresAtMs - Date.now() > 60_000
}

export async function login(): Promise<string> {
  const credentials = readStoredCredentials() ?? promptForCredentials()
  if (!credentials) {
    throw new Error('Missing API credentials')
  }
  writeStoredCredentials(credentials)

  const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: credentials.username, password: credentials.password }),
  })
  if (!response.ok) {
    throw new Error(`login failed: ${response.status}`)
  }
  const body = (await response.json()) as TokenResponse
  writeStoredAuth({ accessToken: body.access_token })
  return body.access_token
}

export async function refresh(accessToken: string): Promise<string> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`refresh failed: ${response.status}`)
  }
  const body = (await response.json()) as TokenResponse
  writeStoredAuth({ accessToken: body.access_token })
  return body.access_token
}

export async function getAccessToken(): Promise<string> {
  const stored = readStoredAuth()
  if (stored?.accessToken && isTokenFresh(stored.accessToken)) {
    return stored.accessToken
  }
  if (stored?.accessToken) {
    try {
      return await refresh(stored.accessToken)
    } catch {
      writeStoredAuth(null)
    }
  }
  return await login()
}

export type UploadResponse = {
  id: string
  status: string
  message: string
  created_at: string
}

export function uploadImage(params: {
  accessToken: string
  blob: Blob
  filename: string
  onProgress?: (progressPct: number) => void
}): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', params.blob, params.filename)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${config.apiBaseUrl}/api/v1/images`)
    xhr.setRequestHeader('Authorization', `Bearer ${params.accessToken}`)
    xhr.responseType = 'json'

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const pct = Math.round((event.loaded / event.total) * 100)
      params.onProgress?.(pct)
    }

    xhr.onerror = () => reject(new Error('network error'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as UploadResponse)
      } else {
        reject(new Error(`upload failed: ${xhr.status}`))
      }
    }
    xhr.send(form)
  })
}

