import { describe, expect, test } from 'vitest'

import { calculateResizedDimensions } from './compression'

describe('calculateResizedDimensions', () => {
  test('preserves aspect ratio when scaling down', () => {
    const original = { width: 4000, height: 3000 }
    const resized = calculateResizedDimensions(original, { maxWidth: 2000, maxHeight: 2000 })
    expect(resized.width).toBeLessThanOrEqual(2000)
    expect(resized.height).toBeLessThanOrEqual(2000)

    const ratio = original.width / original.height
    const idealHeight = resized.width / ratio
    expect(Math.abs(resized.height - idealHeight)).toBeLessThanOrEqual(10.0)
  })

  test('does not upscale images', () => {
    const original = { width: 800, height: 600 }
    const resized = calculateResizedDimensions(original, { maxWidth: 2000, maxHeight: 2000 })
    expect(resized).toEqual(original)
  })

  test('randomized ratio preservation', () => {
    let seed = 1337
    const rand = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }

    for (let i = 0; i < 200; i += 1) {
      const width = Math.floor(rand() * 4900) + 100
      const height = Math.floor(rand() * 4900) + 100
      const maxWidth = Math.floor(rand() * 2900) + 100
      const maxHeight = Math.floor(rand() * 2900) + 100
      const resized = calculateResizedDimensions({ width, height }, { maxWidth, maxHeight })
      expect(resized.width).toBeGreaterThan(0)
      expect(resized.height).toBeGreaterThan(0)
      expect(resized.width).toBeLessThanOrEqual(Math.min(width, maxWidth))
      expect(resized.height).toBeLessThanOrEqual(Math.min(height, maxHeight))

      const ratio = width / height
      const idealHeight = resized.width / ratio
      expect(Math.abs(resized.height - idealHeight)).toBeLessThanOrEqual(10.0)
    }
  })
})
