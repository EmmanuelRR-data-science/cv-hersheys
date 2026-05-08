# SPEC_DRIVEN_CONTRACT

## 1) User Story

Como analista de Hershey's, quiero tomar una foto de un producto con la app movil y ver en el dashboard un resumen de ventas ficticias del producto detectado para poder simular decisiones comerciales durante demos internas.

## 2) Alcance funcional

- La captura y subida de imagen continua igual en `mobile-app`.
- El procesamiento en backend agrega un bloque `sales` dentro de `processing_results.results`.
- El dashboard muestra un panel avanzado de ventas en el detalle de resultado.

## 3) Decisiones tecnicas (Closed)

- Generar ventas ficticias en `backend worker` durante `process_image` y persistir en `processing_results.results`. **Closed**
- Mantener persistencia en JSON (`results`) sin crear tablas nuevas en esta iteracion. **Closed**
- Clasificacion ficticia deterministica por `image_id` para garantizar reproducibilidad en pruebas. **Closed**
- Mantener endpoints existentes (`/api/v1/results`) y compatibilidad backward con clientes actuales. **Closed**
- Mostrar vista avanzada en dashboard: KPIs, tendencia semanal, serie de 30 dias y top tiendas. **Closed**

## 4) Contrato tecnico bloqueado

El backend persistira `results` con esta estructura minima:

```json
{
  "placeholder": true,
  "sales": {
    "product": {
      "brand": "Hershey's",
      "productName": "Kisses Milk Chocolate",
      "sku": "HSY-KISSES-146G",
      "category": "Chocolate"
    },
    "pricing": {
      "suggestedPrice": 59.9,
      "currency": "MXN"
    },
    "kpis": {
      "unitsSold": 1240,
      "estimatedRevenue": 74276,
      "estimatedMarginPct": 31.5
    },
    "context": {
      "channel": "Autoservicio",
      "region": "Centro",
      "storeCount": 28
    },
    "trend": {
      "weeklyTrendPct": 4.2
    },
    "series30d": [
      { "date": "2026-04-09", "units": 38, "revenue": 2276.2 }
    ],
    "topStores": [
      { "storeName": "Walmart Universidad", "units": 180, "revenue": 10782.0 }
    ]
  }
}
```

## 5) Reglas de contrato

- `sales.series30d` debe contener exactamente 30 puntos diarios.
- `sales.topStores` debe incluir entre 3 y 5 tiendas.
- `sales.product.brand` siempre debe ser `Hershey's`.
- `sales.kpis.estimatedRevenue` debe ser consistente con precio sugerido y unidades (aprox., tolerancia por redondeo).
- Si no existe `sales`, el dashboard no rompe y muestra fallback.

## 6) Criterios de verificacion

- Pruebas backend validan estructura completa de `sales`.
- Pruebas dashboard validan render del panel y fallback.
- Integracion upload -> worker -> results devuelve `results.sales`.
