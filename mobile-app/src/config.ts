export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  ocrApiBaseUrl: import.meta.env.VITE_OCR_API_BASE_URL ?? 'http://136.116.56.229:8000/apis/ocr',
  maxUploadBytes: 5 * 1024 * 1024,
}

