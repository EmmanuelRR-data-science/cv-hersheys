import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  test('updates value only after the delay', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 500), {
        initialProps: { value: 'a' },
      })
      expect(result.current).toBe('a')

      rerender({ value: 'ab' })
      expect(result.current).toBe('a')

      act(() => {
        vi.advanceTimersByTime(499)
      })
      expect(result.current).toBe('a')

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe('ab')
    } finally {
      vi.useRealTimers()
    }
  })
})

