import { describe, expect, test } from 'vitest'

import { getPaginationModel } from './pagination'

describe('getPaginationModel', () => {
  test('computes boundaries correctly', () => {
    const model = getPaginationModel({ total: 101, page: 1, limit: 10 })
    expect(model.pageCount).toBe(11)
    expect(model.hasPrev).toBe(false)
    expect(model.hasNext).toBe(true)
    expect(model.prevPage).toBeNull()
    expect(model.nextPage).toBe(2)
  })

  test('randomized invariants for many totals/pages', () => {
    let seed = 424242
    const rand = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }

    for (let i = 0; i < 500; i += 1) {
      const total = Math.floor(rand() * 5000)
      const limit = Math.floor(rand() * 50) + 1
      const pageCount = Math.max(1, Math.ceil(total / limit))
      const page = Math.min(pageCount, Math.floor(rand() * pageCount) + 1)

      const model = getPaginationModel({ total, page, limit })
      expect(model.pageCount).toBe(pageCount)
      expect(model.page).toBe(page)
      expect(model.limit).toBe(limit)

      expect(model.hasPrev).toBe(page > 1)
      expect(model.hasNext).toBe(page < pageCount)
      expect(model.prevPage).toBe(page > 1 ? page - 1 : null)
      expect(model.nextPage).toBe(page < pageCount ? page + 1 : null)

      const expectedOffset = (page - 1) * limit
      const expectedEndExclusive = Math.min(expectedOffset + limit, total)
      expect(model.offset).toBe(expectedOffset)
      expect(model.endExclusive).toBe(expectedEndExclusive)
      expect(model.offset).toBeGreaterThanOrEqual(0)
      expect(model.endExclusive).toBeGreaterThanOrEqual(model.offset)
      expect(model.endExclusive).toBeLessThanOrEqual(total)
    }
  })
})

