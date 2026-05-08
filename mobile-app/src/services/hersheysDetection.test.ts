import { describe, expect, test } from 'vitest'

import { detectHersheysFromRgba, getBrownRatioFromRgba } from './hersheysDetection'

describe('hersheysDetection', () => {
  test('returns high ratio for brown-like pixels', () => {
    const data = new Uint8ClampedArray([
      90, 55, 30, 255,
      110, 70, 40, 255,
      95, 60, 28, 255,
      80, 45, 20, 255,
    ])
    expect(getBrownRatioFromRgba(data)).toBeGreaterThan(0.9)
  })

  test('returns low ratio for non-brown pixels', () => {
    const data = new Uint8ClampedArray([
      10, 100, 210, 255,
      200, 200, 200, 255,
      240, 40, 40, 255,
      40, 220, 60, 255,
    ])
    expect(getBrownRatioFromRgba(data)).toBeLessThan(0.1)
  })

  test('detects hersheys-like image even with blurry tones', () => {
    const data = new Uint8ClampedArray([
      86, 58, 38, 255,
      92, 64, 44, 255,
      121, 96, 72, 255,
      71, 49, 34, 255,
      104, 79, 56, 255,
      66, 44, 31, 255,
      165, 150, 136, 255,
      140, 122, 102, 255,
    ])
    expect(detectHersheysFromRgba(data)).toBe(true)
  })

  test('rejects image with cold colors and low brown signal', () => {
    const data = new Uint8ClampedArray([
      35, 110, 220, 255,
      80, 160, 245, 255,
      170, 200, 210, 255,
      60, 220, 170, 255,
      200, 200, 200, 255,
      180, 180, 190, 255,
      20, 140, 210, 255,
      120, 190, 230, 255,
    ])
    expect(detectHersheysFromRgba(data)).toBe(false)
  })
})
