import { describe, expect, test } from 'vitest'

import { isWithinLocalDateRange, matchesStatus } from './filters'

describe('matchesStatus', () => {
  test('returns true when filter is empty or "all"', () => {
    expect(matchesStatus('processed', '')).toBe(true)
    expect(matchesStatus('processed', 'all')).toBe(true)
  })

  test('matches exact status', () => {
    expect(matchesStatus('processed', 'processed')).toBe(true)
    expect(matchesStatus('pending', 'processed')).toBe(false)
  })

  test('randomized property: when filter is specific, matches imply equality', () => {
    let seed = 101010
    const rand = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    const randInt = (maxExclusive: number) => Math.floor(rand() * maxExclusive)
    const statuses = ['pending', 'processing', 'processed', 'processing_failed']

    for (let i = 0; i < 500; i += 1) {
      const itemStatus = statuses[randInt(statuses.length)]
      const filter = rand() < 0.2 ? 'all' : statuses[randInt(statuses.length)]

      const matched = matchesStatus(itemStatus, filter)
      if (filter === 'all') {
        expect(matched).toBe(true)
      } else if (matched) {
        expect(itemStatus).toBe(filter)
      } else {
        expect(itemStatus).not.toBe(filter)
      }
    }
  })
})

describe('isWithinLocalDateRange', () => {
  test('returns true when no date filters are provided', () => {
    const processedAt = new Date(2026, 4, 7, 12, 0, 0).toISOString()
    expect(isWithinLocalDateRange(processedAt, '', '')).toBe(true)
    expect(isWithinLocalDateRange(processedAt, '', '   ')).toBe(true)
    expect(isWithinLocalDateRange(processedAt, '   ', '')).toBe(true)
  })

  test('requires processedAt when any date filter is set', () => {
    expect(isWithinLocalDateRange(null, '2026-05-07', '')).toBe(false)
    expect(isWithinLocalDateRange(undefined, '', '2026-05-07')).toBe(false)
  })

  test('treats from/to as inclusive local-day boundaries', () => {
    const sameDay = new Date(2026, 4, 7, 12, 0, 0).toISOString()
    const prevDay = new Date(2026, 4, 6, 12, 0, 0).toISOString()
    const nextDay = new Date(2026, 4, 8, 12, 0, 0).toISOString()

    expect(isWithinLocalDateRange(sameDay, '2026-05-07', '2026-05-07')).toBe(true)
    expect(isWithinLocalDateRange(prevDay, '2026-05-07', '2026-05-07')).toBe(false)
    expect(isWithinLocalDateRange(nextDay, '2026-05-07', '2026-05-07')).toBe(false)
  })

  test('randomized property: dates within/outside range behave consistently (local time)', () => {
    let seed = 20260507
    const rand = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    const randInt = (maxExclusive: number) => Math.floor(rand() * maxExclusive)

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

    for (let i = 0; i < 400; i += 1) {
      const year = 2024 + randInt(4)
      const monthIndex = randInt(12)
      const day = 1 + randInt(28)

      const base = new Date(year, monthIndex, day, 12, 0, 0, 0)
      const startOffsetDays = randInt(7)
      const endOffsetDays = startOffsetDays + randInt(7)

      const fromDate = new Date(base)
      fromDate.setDate(fromDate.getDate() - startOffsetDays)
      const toDate = new Date(base)
      toDate.setDate(toDate.getDate() + endOffsetDays)

      const from = toYmd(fromDate)
      const to = toYmd(toDate)

      const within = new Date(base)
      within.setHours(randInt(24), randInt(60), randInt(60), randInt(1000))

      expect(isWithinLocalDateRange(within.toISOString(), from, to)).toBe(true)

      const before = new Date(fromDate)
      before.setDate(before.getDate() - 1)
      before.setHours(12, 0, 0, 0)
      expect(isWithinLocalDateRange(before.toISOString(), from, to)).toBe(false)

      const after = new Date(toDate)
      after.setDate(after.getDate() + 1)
      after.setHours(12, 0, 0, 0)
      expect(isWithinLocalDateRange(after.toISOString(), from, to)).toBe(false)
    }
  })
})
