import { describe, expect, test } from 'vitest'

import { retry } from './retry'

describe('retry', () => {
  test('retries up to maxRetries and eventually succeeds', async () => {
    let attempts = 0
    const value = await retry(
      async () => {
        attempts += 1
        if (attempts < 3) {
          throw new Error('fail')
        }
        return 'ok'
      },
      { maxRetries: 3 },
    )

    expect(value).toBe('ok')
    expect(attempts).toBe(3)
  })

  test('throws the last error after exhausting retries', async () => {
    let attempts = 0
    await expect(
      retry(
        async () => {
          attempts += 1
          throw new Error(`fail-${attempts}`)
        },
        { maxRetries: 3 },
      ),
    ).rejects.toThrow('fail-3')
    expect(attempts).toBe(3)
  })
})

