import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

import { setToken } from '../auth/token'
import { DashboardPage } from './DashboardPage'

const { listResultsMock, getImageFileMock } = vi.hoisted(() => {
  return { listResultsMock: vi.fn(), getImageFileMock: vi.fn() }
})

vi.mock('../services/api', () => {
  return {
    listResults: listResultsMock,
    getImageFile: getImageFileMock,
  }
})

describe('DashboardPage', () => {
  afterEach(() => {
    listResultsMock.mockReset()
    getImageFileMock.mockReset()
    localStorage.clear()
  })

  test('reads filters from URL and preserves them in result links', async () => {
    listResultsMock.mockResolvedValueOnce({
      total: 3,
      items: [
        {
          id: 'abc-1',
          image_id: 'img-1',
          status: 'processed',
          processed_at: new Date(2026, 4, 7, 12, 0, 0).toISOString(),
        },
        {
          id: 'abc-2',
          image_id: 'img-2',
          status: 'pending',
          processed_at: new Date(2026, 4, 7, 12, 0, 0).toISOString(),
        },
        {
          id: 'zzz-3',
          image_id: 'img-3',
          status: 'processed',
          processed_at: new Date(2026, 4, 6, 12, 0, 0).toISOString(),
        },
      ],
    })
    getImageFileMock.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))

    setToken('token-1')
    render(
      <MemoryRouter initialEntries={['/?q=abc&status=processed&from=2026-05-07&to=2026-05-07']}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Search')).toHaveValue('abc')
    expect(screen.getByLabelText('Status')).toHaveValue('processed')
    expect(screen.getByLabelText('From')).toHaveValue('2026-05-07')
    expect(screen.getByLabelText('To')).toHaveValue('2026-05-07')

    const link = await screen.findByRole('link', { name: 'abc-1' })
    expect(link.getAttribute('href')).toContain('/results/abc-1')
    expect(link.getAttribute('href')).toContain('q=abc')
    expect(link.getAttribute('href')).toContain('status=processed')
    expect(link.getAttribute('href')).toContain('from=2026-05-07')
    expect(link.getAttribute('href')).toContain('to=2026-05-07')

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'abc-2' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'zzz-3' })).not.toBeInTheDocument()
    })
  })

  test('automatically refreshes the results list during polling', async () => {
    vi.useFakeTimers()
    try {
      listResultsMock
        .mockResolvedValueOnce({
          total: 1,
          items: [
            {
              id: 'r1',
              image_id: 'i1',
              status: 'processed',
              processed_at: new Date(2026, 4, 7, 12, 0, 0).toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          total: 2,
          items: [
            {
              id: 'r2',
              image_id: 'i2',
              status: 'processed',
              processed_at: new Date(2026, 4, 7, 12, 0, 0).toISOString(),
            },
            {
              id: 'r1',
              image_id: 'i1',
              status: 'processed',
              processed_at: new Date(2026, 4, 7, 12, 0, 0).toISOString(),
            },
          ],
        })
      getImageFileMock.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))

      setToken('token-1')
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>,
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(screen.getByRole('link', { name: 'r1' })).toBeInTheDocument()
      expect(screen.queryByLabelText(/new results/i)).not.toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000)
      })

      expect(screen.getByRole('link', { name: 'r2' })).toBeInTheDocument()
      expect(screen.queryByLabelText(/new results/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
