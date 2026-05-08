import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { setToken } from '../auth/token'
import { ResultDetailPage } from './ResultDetailPage'

const { getResultMock } = vi.hoisted(() => {
  return { getResultMock: vi.fn() }
})

vi.mock('../services/api', () => {
  return {
    getResult: getResultMock,
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
    cleanup()
    getResultMock.mockReset()
    localStorage.clear()
  })

  test('renders result details with sales data', async () => {
    getResultMock.mockResolvedValueOnce({
      id: 'r1',
      image_id: 'i1',
      status: 'processed',
      results: {
        placeholder: true,
        sales: {
          product: {
            brand: "Hershey's",
            productName: "Kisses Milk Chocolate",
            sku: 'HSY-KISSES-146G',
            category: 'Chocolate',
          },
          pricing: { suggestedPrice: 59.9, currency: 'MXN' },
          kpis: { unitsSold: 1240, estimatedRevenue: 74276, estimatedMarginPct: 31.5 },
          context: { channel: 'Autoservicio', region: 'Centro', storeCount: 28 },
          trend: { weeklyTrendPct: 4.2 },
          series30d: [
            { date: '2026-04-01', units: 39, revenue: 2336.1 },
            { date: '2026-04-02', units: 41, revenue: 2455.9 },
          ],
          topStores: [{ storeName: 'Walmart Universidad', units: 180, revenue: 10782 }],
        },
      },
      processed_at: null,
    })

    setToken('token-1')
    render(
      <MemoryRouter initialEntries={['/results/r1?q=abc&status=processed&from=2026-05-07&to=2026-05-07']}>
        <Routes>
          <Route path="/results/:resultId" element={<ResultDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('Detalle')

    const back = screen.getByRole('link', { name: /volver/i })
    expect(back.getAttribute('href')).toContain('/?')
    expect(back.getAttribute('href')).toContain('q=abc')
    expect(back.getAttribute('href')).toContain('status=processed')
    expect(back.getAttribute('href')).toContain('from=2026-05-07')
    expect(back.getAttribute('href')).toContain('to=2026-05-07')

    expect(screen.getByText(/r1/)).toBeInTheDocument()
    expect(screen.getByText(/processed/i)).toBeInTheDocument()
    expect(screen.getByText(/placeholder/i)).toBeInTheDocument()
    const salesPanel = screen.getByLabelText('Datos de ventas')
    expect(salesPanel).toHaveTextContent('Kisses Milk Chocolate')
    expect(salesPanel).toHaveTextContent('Walmart Universidad')
  })

  test('renders fallback when sales data is missing', async () => {
    getResultMock.mockResolvedValueOnce({
      id: 'r1',
      image_id: 'i1',
      status: 'processed',
      results: { placeholder: true },
      processed_at: null,
    })

    setToken('token-1')
    render(
      <MemoryRouter initialEntries={['/results/r1']}>
        <Routes>
          <Route path="/results/:resultId" element={<ResultDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('Detalle')

    expect(screen.getByText(/Sin datos de ventas disponibles/i)).toBeInTheDocument()
  })
})
