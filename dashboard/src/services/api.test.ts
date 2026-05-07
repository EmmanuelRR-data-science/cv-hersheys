import { afterEach, describe, expect, test, vi } from 'vitest'

import { getMe, listResults } from './api'

const fetchMock = vi.fn()
// @ts-ignore test
globalThis.fetch = fetchMock

describe('api', () => {
  afterEach(() => {
    fetchMock.mockReset()
  })

  test('getMe sends bearer token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ username: 'hersheys', role: 'analyst' }),
    })
    const me = await getMe({ token: 't1' })
    expect(me.username).toBe('hersheys')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/me$/), {
      headers: { Authorization: 'Bearer t1' },
    })
  })

  test('listResults calls results endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ total: 1, items: [{ id: 'r1', image_id: 'i1', status: 'processed' }] }),
    })
    const res = await listResults({ token: 't1', page: 1, limit: 10 })
    expect(res.total).toBe(1)
    expect(res.items[0].id).toBe('r1')
  })
})
