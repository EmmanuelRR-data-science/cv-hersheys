function isBrownLikePixel(r: number, g: number, b: number): boolean {
  if (r < 28 || g < 12 || b < 5) return false
  if (r > 200 || g > 165 || b > 130) return false
  if (r + 8 < g) return false
  if (g + 12 < b) return false
  return r - b >= 10
}

export function getBrownRatioFromRgba(data: Uint8ClampedArray): number {
  if (data.length < 4) return 0
  let validPixels = 0
  let brownPixels = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 10) continue
    validPixels += 1
    if (isBrownLikePixel(data[i], data[i + 1], data[i + 2])) {
      brownPixels += 1
    }
  }
  if (validPixels === 0) return 0
  return brownPixels / validPixels
}

type DetectionSignals = {
  brownRatio: number
  warmRatio: number
  darkRatio: number
}

function getDetectionSignals(data: Uint8ClampedArray): DetectionSignals {
  let validPixels = 0
  let brownPixels = 0
  let warmPixels = 0
  let darkPixels = 0

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 10) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    validPixels += 1

    if (isBrownLikePixel(r, g, b)) {
      brownPixels += 1
    }

    if (r > g && g >= b * 0.75 && r - b >= 8) {
      warmPixels += 1
    }

    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    if (luma < 95) {
      darkPixels += 1
    }
  }

  if (validPixels === 0) {
    return { brownRatio: 0, warmRatio: 0, darkRatio: 0 }
  }

  return {
    brownRatio: brownPixels / validPixels,
    warmRatio: warmPixels / validPixels,
    darkRatio: darkPixels / validPixels,
  }
}

export function detectHersheysFromRgba(data: Uint8ClampedArray): boolean {
  const signals = getDetectionSignals(data)
  const score = signals.brownRatio * 0.55 + signals.warmRatio * 0.25 + signals.darkRatio * 0.2

  if (signals.brownRatio >= 0.03 && score >= 0.16) return true
  if (signals.brownRatio >= 0.02 && signals.darkRatio >= 0.25 && signals.warmRatio >= 0.08) return true
  return score >= 0.22
}

export async function detectHersheysProduct(blob: Blob): Promise<boolean> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return false
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return false
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return detectHersheysFromRgba(imageData.data)
  } catch {
    return false
  } finally {
    if (bitmap) {
      try {
        bitmap.close()
      } catch {
        // Ignore cleanup errors to avoid masking detection result.
      }
    }
  }
}
