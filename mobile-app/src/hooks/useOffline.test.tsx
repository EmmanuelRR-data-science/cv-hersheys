import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { useOffline } from './useOffline'

describe('useOffline', () => {
  test('toggles online state from browser events', () => {
    const { result } = renderHook(() => useOffline())
    expect(result.current.isOnline).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOnline).toBe(true)
  })
})
