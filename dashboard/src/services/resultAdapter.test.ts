import { describe, expect, test } from 'vitest'

import { adaptResult, adaptResultList, isSalesData } from './resultAdapter'

function hashSeed(seed: string): number {
  let hash = 0
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 31 + seed.charCodeAt(idx)) >>> 0
  }
  return hash
}

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
    expect(adapted.results?.sales?.topStores.length).toBeGreaterThanOrEqual(3)
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

  test('completa topStores hasta minimo 3 cuando conteo_general es pequeno', () => {
    const adapted = adaptResult({
      id: 'r-external-small-stores',
      image_id: 'img-small',
      status: 'processed',
      results: {
        filename: 'img-small.jpg',
        total_productos: 5,
        conteo_general: {
          'Tienda unica': 1,
        },
        precios: {
          'Tienda unica': { precio: '19.50' },
        },
      },
    })

    const topStores = adapted.results?.sales?.topStores ?? []
    expect(topStores).toHaveLength(3)
    expect(topStores[0]?.storeName).toBe('Tienda unica')
  })

  test('series30d mantiene diferencia de 29 dias al cruzar mes', () => {
    const imageId = Array.from({ length: 1000 })
      .map((_, idx) => `img-${idx}`)
      .find((candidate) => hashSeed(candidate) % 365 === 50)

    expect(imageId).toBeTruthy()

    const adapted = adaptResult({
      id: 'r-cross-month',
      image_id: imageId,
      status: 'processed',
      results: {
        filename: `${imageId}.jpg`,
        total_productos: 18,
        conteo_general: { 'Walmart Universidad': 5 },
        precios: { 'Walmart Universidad': { precio: '20.0' } },
      },
    })

    const series = adapted.results?.sales?.series30d ?? []
    const first = new Date(`${series[0]?.date}T00:00:00.000Z`)
    const last = new Date(`${series[series.length - 1]?.date}T00:00:00.000Z`)
    const diffDays = Math.round((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000))

    expect(series).toHaveLength(30)
    expect(last.toISOString().slice(0, 10)).toBe('2026-02-20')
    expect(first.toISOString().slice(0, 10)).toBe('2026-01-22')
    expect(diffDays).toBe(29)
  })
})
