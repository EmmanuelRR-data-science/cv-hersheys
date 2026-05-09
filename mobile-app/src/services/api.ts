import { config } from '../config'

export type UploadResponse = {
  id: string
  status: string
  message: string
  created_at: string
}

export function uploadImage(params: {
  blob: Blob
  filename: string
  onProgress?: (progressPct: number) => void
}): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', params.blob, params.filename)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${config.apiBaseUrl}/api/v1/images`)
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

