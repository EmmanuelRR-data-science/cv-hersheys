import { describe, expect, test } from 'vitest'

import { buildHersheysGetImageInfoResponse } from './ocr'

describe('buildHersheysGetImageInfoResponse', () => {
  test('mantiene estructura del endpoint con datos de Hersheys', () => {
    const output = buildHersheysGetImageInfoResponse(
      {
        status_message: 'Imagen procesada correctamente.',
        filename: 'foto.jpg',
        total_productos: 7,
        timing: { total: 4.5 },
        detections: {
          xyxy: [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
          ],
          confidence: [0.8, 0.7],
          class_id: [1, 2],
        },
      },
      { storeName: 'Walmart Universidad' },
    )

    expect(output.status_message).toContain('Store: Walmart Universidad')
    expect(output.filename).toBe('foto.jpg')
    expect(output.total_productos).toBe(7)
    expect(output.conteo_gastillo).toBe(7)
    expect(output.porcentaje_anaquel_castillo).toBe(100)
    expect(output.porcentaje_anaquel_directa).toBe(0)
    expect(output.porcetaje_anaquel_indirecta).toBe(0)
    expect(Object.keys(output.conteo_general)).toHaveLength(5)
    expect(Object.keys(output.precios)).toHaveLength(5)
    expect(output.acomodo_filas['fila 1']).toBeDefined()
    expect(output.acomodo_filas['fila 2']).toBeDefined()
    expect(output.detections.xyxy).toHaveLength(2)
  })

  test('usa detecciones como fallback cuando total_productos no existe', () => {
    const output = buildHersheysGetImageInfoResponse(
      {
        detections: {
          xyxy: [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
          ],
          confidence: [0.8, 0.7, 0.9],
          class_id: [1, 2, 3],
        },
      },
      { storeName: 'Chedraui Satelite' },
    )
    expect(output.total_productos).toBe(3)
    expect(output.conteo_gastillo).toBe(3)
  })
})
