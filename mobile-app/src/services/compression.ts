export type Dimensions = { width: number; height: number }

export type ResizeConstraints = {
  maxWidth: number
  maxHeight: number
}

export function calculateResizedDimensions(
  original: Dimensions,
  constraints: ResizeConstraints,
): Dimensions {
  const width = Math.max(1, Math.floor(original.width))
  const height = Math.max(1, Math.floor(original.height))
  const maxWidth = Math.max(1, Math.floor(constraints.maxWidth))
  const maxHeight = Math.max(1, Math.floor(constraints.maxHeight))

  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }

  const scale = Math.min(maxWidth / width, maxHeight / height)
  const rawWidth = width * scale
  const rawHeight = height * scale
  const ratio = width / height

  const widthOptions = new Set<number>()
  const heightOptions = new Set<number>()

  for (const base of [Math.floor(rawWidth), Math.ceil(rawWidth)]) {
    for (const delta of [-1, 0, 1]) {
      widthOptions.add(Math.max(1, Math.min(maxWidth, base + delta)))
    }
  }
  for (const base of [Math.floor(rawHeight), Math.ceil(rawHeight)]) {
    for (const delta of [-1, 0, 1]) {
      heightOptions.add(Math.max(1, Math.min(maxHeight, base + delta)))
    }
  }

  const widthList = [...widthOptions]
  const heightList = [...heightOptions]

  let best = { width: widthList[0], height: heightList[0] }
  let bestDiff = Math.abs(ratio - best.width / best.height)

  for (const w of widthList) {
    for (const h of heightList) {
      if (w > maxWidth || h > maxHeight) continue
      if (w > width || h > height) continue
      const diff = Math.abs(ratio - w / h)
      if (diff < bestDiff) {
        best = { width: w, height: h }
        bestDiff = diff
      }
    }
  }

  return best
}

export type CompressImageOptions = {
  maxBytes: number
  maxWidth: number
  maxHeight: number
  initialQuality?: number
  minQuality?: number
}

export async function compressImageToJpeg(
  input: Blob,
  options: CompressImageOptions,
): Promise<Blob> {
  const bitmap = await createImageBitmap(input)
  const target = calculateResizedDimensions(
    { width: bitmap.width, height: bitmap.height },
    { maxWidth: options.maxWidth, maxHeight: options.maxHeight },
  )

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('missing canvas context')
  }
  ctx.drawImage(bitmap, 0, 0, target.width, target.height)

  const maxBytes = Math.max(1, Math.floor(options.maxBytes))
  const initialQuality = options.initialQuality ?? 0.9
  const minQuality = options.minQuality ?? 0.5

  let quality = initialQuality
  let blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    )
  })

  while (blob.size > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.1)
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        quality,
      )
    })
  }

  return blob
}
