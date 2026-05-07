import { describe, expect, test } from 'vitest'

import { matchesQuery, type SearchableResult } from './search'

describe('matchesQuery', () => {
  test('returns true for empty query', () => {
    expect(matchesQuery({ id: 'r1', image_id: 'i1', status: 'processed' }, '')).toBe(true)
    expect(matchesQuery({ id: 'r1', image_id: 'i1', status: 'processed' }, '   ')).toBe(true)
  })

  test('matches case-insensitively on id, image_id, and status', () => {
    const item = { id: 'ABC-123', image_id: 'IMG-999', status: 'Processing_Failed' }
    expect(matchesQuery(item, 'abc')).toBe(true)
    expect(matchesQuery(item, '999')).toBe(true)
    expect(matchesQuery(item, 'failed')).toBe(true)
    expect(matchesQuery(item, 'missing')).toBe(false)
  })

  test('randomized property: substring queries match; non-substring queries do not', () => {
    let seed = 911733
    const rand = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }

    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789-_'
    const randInt = (maxExclusive: number) => Math.floor(rand() * maxExclusive)
    const randomString = (minLen: number, maxLen: number) => {
      const length = minLen + randInt(maxLen - minLen + 1)
      let out = ''
      for (let i = 0; i < length; i += 1) {
        out += alphabet[randInt(alphabet.length)]
      }
      return out
    }

    const mixedCase = (input: string) =>
      input
        .split('')
        .map((ch) => (rand() < 0.5 ? ch.toUpperCase() : ch.toLowerCase()))
        .join('')

    for (let i = 0; i < 500; i += 1) {
      const item: SearchableResult = {
        id: randomString(1, 24),
        image_id: randomString(1, 24),
        status: randomString(1, 24),
      }

      const sources = [item.id, item.image_id, item.status]
      const source = sources[randInt(sources.length)].trim().toLowerCase()

      const start = randInt(source.length)
      const end = start + 1 + randInt(source.length - start)
      const substring = source.slice(start, end)
      const query = rand() < 0.5 ? ` ${mixedCase(substring)} ` : mixedCase(substring)

      expect(matchesQuery(item, query)).toBe(true)

      const negativeQuery = rand() < 0.5 ? ` ~${randomString(1, 10)} ` : `~${randomString(1, 10)}`
      expect(matchesQuery(item, negativeQuery)).toBe(false)
    }
  })
})
