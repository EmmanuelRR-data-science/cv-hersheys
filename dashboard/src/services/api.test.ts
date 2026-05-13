import { afterEach, describe, expect, test, vi } from 'vitest'

import { getMe, getResult, listResults, login } from './api'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

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

  test('getResult adapta payload externo a sales para dashboard', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'r-external-1',
        image_id: 'img28',
        status: 'processed',
        results: {
          filename: 'img28.jpg',
          total_productos: 18,
          conteo_general: {
            "Habanera Roja La Guacamaya": 3,
          },
          precios: {
            "Habanera Roja La Guacamaya": { precio: '14.99', oferta: 'si' },
          },
        },
      }),
    })

    const result = await getResult({ token: 't1', resultId: 'r-external-1' })
    expect(result.results?.sales).toBeTruthy()
    expect(result.results?.sales?.series30d).toHaveLength(30)
  })

  test('login sends username and password', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 't2', token_type: 'bearer' }),
    })
    const response = await login({ username: 'hersheys', password: 'cv-hersheys' })
    expect(response.access_token).toBe('t2')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/auth\/login$/), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hersheys', password: 'cv-hersheys' }),
    })
  })
})
