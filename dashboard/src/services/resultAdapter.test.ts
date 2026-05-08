import { describe, expect, test } from 'vitest'

import { adaptResult, adaptResultList, isSalesData } from './resultAdapter'

describe('resultAdapter', () => {
  test('adapta payload externo con typos y genera sales estable', () => {
    const adapted = adaptResult({
      id: 'r-external-1',
      image_id: 'img28',
      status: 'processed',
      results: {
        status_message: 'Imagen procesada correctamente.',
        filename: 'img28.jpg',
        total_productos: 18,
        conteo_general: {
          "7 Mares Huichol": 5,
          "Habanera Roja La Guacamaya": 3,
        },
        conteo_gastillo: 4,
        conteo_competencia_directa: 8,
        conteo_competencia_indirecta: 6,
        porcentaje_anaquel_castillo: 22.22,
        porcetaje_anaquel_indirecta: 33.34,
        precios: {
          "Habanera Roja La Guacamaya": { precio: '14.99', oferta: 'si' },
        },
        detections: {
          xyxy: [[5.25, 128.99, 127.36, 496.9]],
        },
      },
      processed_at: '2026-05-08T12:00:00.000Z',
    })

    expect(adapted.results?.sales).toBeTruthy()
    expect(adapted.results?.sales?.product.brand).toBe("Hershey's")
    expect(adapted.results?.sales?.series30d).toHaveLength(30)
    expect(adapted.results?.sales?.topStores.length).toBeGreaterThanOrEqual(1)
    expect(adapted.results?.sales?.pricing.currency).toBe('MXN')

    const series = adapted.results?.sales?.series30d ?? []
    expect(series[0]?.date).toMatch(/^2026-/)
    expect(series[series.length - 1]?.date).toMatch(/^2026-/)
  })

  test('respeta sales existentes ya validos', () => {
    const adapted = adaptResult({
      id: 'r-existing-1',
      image_id: 'img-existing',
      status: 'processed',
      results: {
        placeholder: true,
        sales: {
          product: {
            brand: "Hershey's",
            productName: 'Kisses',
            sku: 'HSY-KISSES-001',
            category: 'Chocolate',
          },
          pricing: { suggestedPrice: 59.9, currency: 'MXN' },
          kpis: { unitsSold: 1200, estimatedRevenue: 71880, estimatedMarginPct: 31.5 },
          context: { channel: 'Autoservicio', region: 'Centro', storeCount: 20 },
          trend: { weeklyTrendPct: 4.2 },
          series30d: [{ date: '2026-04-01', units: 38, revenue: 2276.2 }],
          topStores: [{ storeName: 'Walmart Universidad', units: 180, revenue: 10782 }],
        },
      },
    })

    expect(adapted.results?.sales?.product.productName).toBe('Kisses')
    expect(adapted.results?.sales?.series30d).toHaveLength(1)
  })

  test('adapta lista de resultados y total', () => {
    const list = adaptResultList({
      total: 2,
      items: [
        { id: 'r1', image_id: 'i1', status: 'processed', results: { placeholder: true } },
        { id: 'r2', image_id: 'i2', status: 'pending', results: null },
      ],
    })

    expect(list.total).toBe(2)
    expect(list.items).toHaveLength(2)
    expect(list.items[0].id).toBe('r1')
  })

  test('isSalesData falla cuando series/topStores tienen estructura invalida', () => {
    const invalid = {
      product: { brand: "Hershey's", productName: 'Kisses', sku: 'HSY-KISSES-001', category: 'Chocolate' },
      pricing: { suggestedPrice: 59.9, currency: 'MXN' },
      kpis: { unitsSold: 1200, estimatedRevenue: 71880, estimatedMarginPct: 31.5 },
      context: { channel: 'Autoservicio', region: 'Centro', storeCount: 20 },
      trend: { weeklyTrendPct: 4.2 },
      series30d: [{ date: '2026-04-01', units: 38 }],
      topStores: [{ storeName: 'Walmart Universidad', units: 180, revenue: 10782 }],
    }

    expect(isSalesData(invalid)).toBe(false)
  })
})
