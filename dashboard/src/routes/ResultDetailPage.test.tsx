import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { setToken } from '../auth/token'
import { ResultDetailPage } from './ResultDetailPage'

vi.mock('../services/api', () => {
  return {
    getResult: vi.fn(async () => ({
      id: 'r1',
      image_id: 'i1',
      status: 'processed',
      results: { placeholder: true },
      processed_at: null,
    })),
    getImage: vi.fn(async () => ({
      id: 'i1',
      original_filename: 'photo.jpg',
      format: 'jpeg',
      size_bytes: 3,
      status: 'processed',
      created_at: new Date().toISOString(),
    })),
    getImageFile: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
  }
})

describe('ResultDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  test('renders result details', async () => {
    setToken('token-1')
    render(
      <MemoryRouter initialEntries={['/results/r1?q=abc&status=processed&from=2026-05-07&to=2026-05-07']}>
        <Routes>
          <Route path="/results/:resultId" element={<ResultDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Resultado/i)).toBeInTheDocument()
    })

    const back = screen.getByRole('link', { name: /volver/i })
    expect(back.getAttribute('href')).toContain('/?')
    expect(back.getAttribute('href')).toContain('q=abc')
    expect(back.getAttribute('href')).toContain('status=processed')
    expect(back.getAttribute('href')).toContain('from=2026-05-07')
    expect(back.getAttribute('href')).toContain('to=2026-05-07')

    expect(screen.getByText(/r1/)).toBeInTheDocument()
    expect(screen.getByText(/processed/i)).toBeInTheDocument()
    expect(screen.getByText(/placeholder/i)).toBeInTheDocument()
  })
})
