import { useEffect, useMemo } from 'react'

import { Button } from '../UI/Button'

type Props = {
  blob: Blob
  onConfirm: () => void
  onRetake: () => void
  busy?: boolean
  detectedHersheys: boolean
}

export function ImagePreview(props: Props) {
  const url = useMemo(() => URL.createObjectURL(props.blob), [props.blob])
  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <div className="preview-wrap">
      <img className="preview-img" src={url} alt="captured" />
      {!props.detectedHersheys ? (
        <div className="capture-warning">
          No se detectó un producto Hershey&apos;s. Toma otra foto para poder procesarla.
        </div>
      ) : null}
      <div className="preview-actions">
        <Button variant="secondary" onClick={props.onRetake} disabled={props.busy}>
          Repetir
        </Button>
        <Button onClick={props.onConfirm} disabled={props.busy || !props.detectedHersheys}>
          Subir
        </Button>
      </div>
    </div>
  )
}

