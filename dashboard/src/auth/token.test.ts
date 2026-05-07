import { describe, expect, test } from 'vitest'

import { clearToken, getToken, setToken } from './token'

describe('token storage', () => {
  test('stores and retrieves token', () => {
    clearToken()
    expect(getToken()).toBeNull()
    setToken('abc')
    expect(getToken()).toBe('abc')
    clearToken()
    expect(getToken()).toBeNull()
  })
})

