import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '../UI/Button'

type Props = {
  onCaptured: (data: { blob: Blob; filename: string; contentType: string }) => void
}

export function CameraCapture(props: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const canUseCamera = useMemo(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices, [])

  useEffect(() => {
    if (!canUseCamera) {
      setError('Este dispositivo no soporta cámara en el navegador.')
      return
    }

    let cancelled = false
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch {
        setError('Permiso de cámara denegado o no disponible.')
      }
    }
    start()

    return () => {
      cancelled = true
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
      streamRef.current = null
    }
  }, [canUseCamera])

  const capture = async () => {
    const video = videoRef.current
    if (!video) return
    const width = Math.max(1, video.videoWidth)
    const height = Math.max(1, video.videoHeight)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('No se pudo capturar la imagen.')
      return
    }
    ctx.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.95,
      )
    }).catch(() => null)

    if (!blob) {
      setError('No se pudo generar el archivo de imagen.')
      return
    }

    const filename = `capture-${Date.now()}.jpg`
    props.onCaptured({ blob, filename, contentType: 'image/jpeg' })
  }

  if (error) {
    return <div className="camera-error">{error}</div>
  }

  return (
    <div className="camera-wrap">
      <video ref={videoRef} className="camera-video" playsInline muted />
      <div className="camera-actions">
        <Button onClick={capture} disabled={!ready}>
          Capturar
        </Button>
      </div>
    </div>
  )
}

