import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

import { setToken } from '../auth/token'
import { ResultDetailPage } from './ResultDetailPage'

const { getResultMock, getOcrInfoMock } = vi.hoisted(() => {
  return { getResultMock: vi.fn(), getOcrInfoMock: vi.fn() }
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
      store_name: 'Walmart Universidad',
      store_code: 'WMT-UNIV',
      created_at: new Date().toISOString(),
    })),
    getImageFile: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
    getAnnotatedImageFile: vi.fn(async () => new Blob(['y'], { type: 'image/jpeg' })),
    getImageOcrInfo: getOcrInfoMock,
  }
})

describe('ResultDetailPage', () => {
  afterEach(() => {
    cleanup()
    getResultMock.mockReset()
    getOcrInfoMock.mockReset()
    localStorage.clear()
  })

  test('renders result details with sales data hidden by default', async () => {
    getResultMock.mockResolvedValueOnce({
      id: 'r1',
      image_id: 'i1',
      status: 'processed',
      results: {
        placeholder: true,
        ocrInsights: {
          totalProducts: 18,
          detectedBoxes: 9,
          hersheysCount: 7,
          directCompetitionCount: 6,
          indirectCompetitionCount: 5,
          hersheysSharePct: 38.88,
          directSharePct: 33.33,
          indirectSharePct: 27.79,
          processingSeconds: 9.33,
          topDetectedLabel: 'Hershey Kisses',
        },
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

    await screen.findByText('Details')

    const back = screen.getByRole('link', { name: /back/i })
    expect(back.getAttribute('href')).toContain('/?')
    expect(back.getAttribute('href')).toContain('q=abc')
    expect(back.getAttribute('href')).toContain('status=processed')
    expect(back.getAttribute('href')).toContain('from=2026-05-07')
    expect(back.getAttribute('href')).toContain('to=2026-05-07')

    expect(screen.getByText(/r1/)).toBeInTheDocument()
    expect(screen.getByText('processed', { selector: '.pill' })).toBeInTheDocument()
    expect(screen.getByText('Store: Walmart Universidad (WMT-UNIV)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sales data')).not.toBeInTheDocument()
    expect(screen.queryByText('Kisses Milk Chocolate')).not.toBeInTheDocument()
    const ocrPanel = screen.getByLabelText('OCR metrics')
    expect(ocrPanel).toHaveTextContent('Detected products')
    expect(ocrPanel).toHaveTextContent('Hershey Kisses')

    expect(screen.getByRole('heading', { name: 'Shelf Intelligence' })).toBeInTheDocument()
    expect(screen.queryByLabelText("Hershey's view")).not.toBeInTheDocument()
  })

  test('renders provider OCR table when ocr_info resolves', async () => {
    getResultMock.mockResolvedValueOnce({
      id: 'r2',
      image_id: 'i2',
      status: 'processed',
      results: {
        placeholder: true,
        sales: {
          product: {
            brand: "Hershey's",
            productName: 'Kisses Milk Chocolate',
            sku: 'HSY-KISSES-146G',
            category: 'Chocolate',
          },
          pricing: { suggestedPrice: 59.9, currency: 'MXN' },
          kpis: { unitsSold: 1240, estimatedRevenue: 74276, estimatedMarginPct: 31.5 },
          context: { channel: 'Autoservicio', region: 'Centro', storeCount: 28 },
          trend: { weeklyTrendPct: 4.2 },
          series30d: [],
          topStores: [],
        },
      },
      processed_at: null,
    })

    getOcrInfoMock.mockResolvedValueOnce({
      status_message: 'Imagen procesada correctamente.',
      filename: 'shelf.jpg',
      total_productos: 18,
      conteo_general: { '7 Mares Huichol': 5, 'Habanera Roja La Guacamaya': 3 },
      conteo_gastillo: 4,
      conteo_competencia_directa: 8,
      conteo_competencia_indirecta: 6,
      porcentaje_anaquel_castillo: 22.22,
      porcetaje_anaquel_indirecta: 33.34,
      precios: { 'Habanera Roja La Guacamaya': { precio: '14.99', oferta: 'si' } },
    })

    setToken('token-1')
    render(
      <MemoryRouter initialEntries={['/results/r2']}>
        <Routes>
          <Route path="/results/:resultId" element={<ResultDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const originalView = await screen.findByLabelText('Provider API response')
    await waitFor(() => expect(originalView).toHaveTextContent('Imagen procesada correctamente.'))
    expect(originalView).toHaveTextContent('shelf.jpg')
    expect(originalView).toHaveTextContent('Product Count')
    expect(originalView).not.toHaveTextContent('conteo_general')
    expect(originalView).toHaveTextContent('Habanera Roja La Guacamaya')
    expect(originalView).toHaveTextContent("Hershey's shelf share")
    expect(originalView).toHaveTextContent('Indirect competitor shelf share')
    expect(originalView).toHaveTextContent('22.22%')
    expect(originalView).toHaveTextContent('33.34%')
  })

  test('shows graceful error in original panel when ocr_info fails', async () => {
    getResultMock.mockResolvedValueOnce({
      id: 'r3',
      image_id: 'i3',
      status: 'processed',
      results: { placeholder: true },
      processed_at: null,
    })
    getOcrInfoMock.mockRejectedValueOnce(new Error('ocr info failed: 502'))

    setToken('token-1')
    render(
      <MemoryRouter initialEntries={['/results/r3']}>
        <Routes>
          <Route path="/results/:resultId" element={<ResultDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const originalView = await screen.findByLabelText('Provider API response')
    await waitFor(() =>
      expect(originalView).toHaveTextContent(/Provider OCR data unavailable/i),
    )
    expect(originalView).toHaveTextContent('ocr info failed: 502')
  })

  test('keeps sales data fallback hidden when sales data is missing', async () => {
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

    await screen.findByText('Details')

    expect(screen.queryByLabelText('Sales data')).not.toBeInTheDocument()
    expect(screen.queryByText(/No sales data available/i)).not.toBeInTheDocument()
  })
})
