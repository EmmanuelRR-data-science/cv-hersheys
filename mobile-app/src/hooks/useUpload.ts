import { useCallback, useMemo, useRef, useState } from 'react'

import { config } from '../config'
import { uploadImage } from '../services/api'
import { compressImageToJpeg } from '../services/compression'
import { enqueueImage, listQueuedImages, removeQueuedImage } from '../services/offlineQueue'
import { retry } from '../services/retry'

export type UploadState =
  | { status: 'idle'; progressPct: 0; message?: string }
  | { status: 'uploading'; progressPct: number; message?: string }
  | { status: 'success'; progressPct: 100; message: string }
  | { status: 'queued'; progressPct: 0; message: string }
  | { status: 'error'; progressPct: 0; message: string }

export function useUpload(params: { isOnline: boolean }) {
  const [state, setState] = useState<UploadState>({ status: 'idle', progressPct: 0 })
  const isDrainingRef = useRef(false)

  const canUpload = useMemo(() => params.isOnline, [params.isOnline])

  const upload = useCallback(
    async (input: { blob: Blob; filename: string; contentType: string }) => {
      if (!canUpload) {
        await enqueueImage(input)
        setState({ status: 'queued', progressPct: 0, message: 'Guardado para subir cuando haya conexión' })
        return
      }

      setState({ status: 'uploading', progressPct: 0 })
      try {
        const compressed = await compressImageToJpeg(input.blob, {
          maxBytes: config.maxUploadBytes,
          maxWidth: 4096,
          maxHeight: 4096,
        })

        const response = await retry(
          async () =>
            await uploadImage({
              blob: compressed,
              filename: input.filename,
              onProgress: (progressPct) => setState({ status: 'uploading', progressPct }),
            }),
          { maxRetries: 3, delayMs: 400 },
        )

        setState({ status: 'success', progressPct: 100, message: `Subido: ${response.id}` })
      } catch (error) {
        await enqueueImage(input)
        setState({ status: 'queued', progressPct: 0, message: 'No se pudo subir. Se guardó para reintentar.' })
      }
    },
    [canUpload],
  )

  const drainQueue = useCallback(async () => {
    if (!params.isOnline) return
    if (isDrainingRef.current) return
    isDrainingRef.current = true

    try {
      const items = await listQueuedImages()
      if (items.length === 0) return
      setState({ status: 'uploading', progressPct: 0, message: 'Subiendo pendientes...' })

      for (const item of items) {
        const response = await retry(
          async () =>
            await uploadImage({
              blob: item.blob,
              filename: item.filename,
              onProgress: (progressPct) => setState({ status: 'uploading', progressPct }),
            }),
          { maxRetries: 3, delayMs: 600 },
        )
        await removeQueuedImage(item.id)
        setState({ status: 'success', progressPct: 100, message: `Pendiente subido: ${response.id}` })
      }
    } finally {
      isDrainingRef.current = false
    }
  }, [params.isOnline])

  return { state, upload, drainQueue }
}

