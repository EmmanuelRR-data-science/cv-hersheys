# SPEC_DRIVEN_CONTRACT

## 1) User Story

Como analista de Hershey's, quiero que el dashboard procese un JSON externo de anaquel (como el de `json-hersheys.txt`) y lo transforme a un modelo estable de visualizacion, para revisar KPIs y contexto comercial sin romper la UI aunque cambie el formato del proveedor.

Como operador en mobile, quiero seleccionar primero la tienda donde realizo el registro y despues elegir si capturo foto o subo un archivo (`.jpg/.png`), para procesar la imagen contra `get_image_info` y visualizar una salida con estructura compatible al endpoint, pero orientada a datos de portafolio Hershey's.

## 2) Technical Contract (Locked)

### 2.1 Contrato externo (`ExternalPayload`) - entrada variable

El JSON de proveedor puede incluir campos como:

```json
{
  "status_message": "Imagen procesada correctamente.",
  "filename": "img28.jpg",
  "total_productos": 18,
  "conteo_general": {
    "7 Mares Huichol": 5,
    "Habanera Roja La Guacamaya": 3
  },
  "conteo_gastillo": 4,
  "conteo_competencia_directa": 8,
  "conteo_competencia_indirecta": 6,
  "porcentaje_anaquel_castillo": 22.22,
  "porcentaje_anaquel_directa": 44.44,
  "porcetaje_anaquel_indirecta": 33.34,
  "acomodo_filas": {
    "fila 1": {
      "7 Mares Huichol": 5
    }
  },
  "precios": {
    "Habanera Roja La Guacamaya": {
      "precio": "14.99",
      "oferta": "si"
    }
  },
  "detections": {
    "xyxy": [[5.25, 128.99, 127.36, 496.9]]
  }
}
```

### 2.2 Contrato interno (`DashboardViewModel`) - salida estable para UI

El dashboard debe consumir un modelo interno consistente:

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

## 3) Decisiones Tecnicas (Closed)

- Introducir una capa de adaptacion `ExternalPayload -> DashboardViewModel` en Service Layer, sin acoplar componentes al JSON crudo. **Closed**
- Mantener `processing_results.results` como JSON flexible, sin crear tablas nuevas en esta iteracion. **Closed**
- Conservar endpoints existentes (`/api/v1/results`) para compatibilidad backward. **Closed**
- Mantener datos inventados como fallback cuando el JSON externo llegue incompleto o invalido. **Closed**
- Tolerar variaciones y typos de proveedor (`conteo_gastillo`, `porcetaje_*`) en la normalizacion. **Closed**
- Mantener render de fallback en dashboard si `sales` no cumple contrato minimo. **Closed**
- Habilitar modo demo en mobile para subir imagenes sin login explicito, conservando autenticacion en dashboard/resultados. **Closed**
- Exigir seleccion de tienda en mobile antes de habilitar captura o carga de archivo. **Closed**
- Ofrecer dos fuentes de imagen en mobile: camara y selector de archivo local (`jpg/png`). **Closed**
- Consumir `POST /get_image_info` (multipart con `image_file`) para procesar imagen desde mobile. **Closed**
- Mantener en mobile la estructura JSON de `get_image_info`, aplicando una transformacion de contenido hacia catalogo Hershey's para presentacion en UI. **Closed**
- Usar un catalogo fijo de 5 tiendas de ejemplo en la app mobile para esta iteracion. **Closed**
- Tras procesar OCR exitoso en mobile, subir la imagen original al backend (`POST /api/v1/images`) para que el dashboard la liste con miniatura y detalle. **Closed**
- Rechazar en mobile cualquier blob menor a 1024 bytes antes de invocar OCR o subir, para evitar capturas vacias. **Closed**
- En dashboard, tratar como `No preview` cualquier imagen retornada con tamano menor a 100 bytes o que falle al renderizar (`onError`). **Closed**
- Exponer endpoint backend `GET /api/v1/images/{id}/annotated` que llama al `POST /predict` del OCR externo, cachea el JPEG anotado en MinIO con sufijo `_annotated.jpeg` y lo sirve como `image/jpeg`. **Closed**
- Configurar el cliente OCR del backend con `OCR_API_BASE_URL` (default `http://136.116.56.229:8000/apis/ocr`) y `OCR_API_TIMEOUT_SECONDS` (default 30s). **Closed**
- Usar `httpx` como cliente HTTP de runtime en el backend para integraciones externas. **Closed**
- En la pagina de detalle del dashboard, mostrar la imagen original capturada junto a la imagen anotada del `/predict` en un layout pareado. **Closed**
- Proxy del OCR `get_image_info` a traves del backend (`POST /api/v1/ocr/get_image_info`, multipart `image_file`) para evitar mixed content cuando la mobile-app se sirve por HTTPS. La mobile no debe llamar al OCR externo directamente. **Closed**
- Eliminar `ocrApiBaseUrl` del cliente mobile; toda integracion OCR pasa por `apiBaseUrl` del backend. **Closed**

## 4) Mapeo de Campos (Closed)

- `filename` -> semilla para datos inventados deterministas (si faltan campos de negocio). **Closed**
- `total_productos` -> `sales.kpis.unitsSold` (con regla de escalamiento definida por adaptador). **Closed**
- `conteo_general` -> base para `topStores` o resumen de participacion por marca. **Closed**
- `precios.*.precio` -> `sales.pricing.suggestedPrice` (promedio/prioridad configurable). **Closed**
- `porcentaje_anaquel_castillo` -> señal para `sales.trend.weeklyTrendPct` y/o contexto competitivo. **Closed**
- `conteo_competencia_directa` y `conteo_competencia_indirecta` -> contexto competitivo para KPIs derivados. **Closed**
- `detections.xyxy` -> metrica auxiliar (conteo de detecciones) para consistencia de totales. **Closed**

## 5) Reglas de Contrato (Closed)

- `sales.series30d` debe contener exactamente 30 puntos diarios. **Closed**
- `sales.topStores` debe incluir entre 3 y 5 tiendas. **Closed**
- `sales.product.brand` siempre debe ser `Hershey's`. **Closed**
- `sales.kpis.estimatedRevenue` debe ser consistente con precio sugerido y unidades (aprox., tolerancia por redondeo). **Closed**
- Si no existe `sales` valido, el dashboard no rompe y muestra fallback seguro. **Closed**
- El adaptador debe aceptar `unknown` como entrada y devolver un objeto tipado o `null` controlado. **Closed**
- En mobile no se permite procesar imagen sin tienda seleccionada. **Closed**
- El flujo mobile debe aceptar `image/jpeg`, `image/jpg` y `image/png` desde captura o archivo local. **Closed**
- La respuesta mostrada en mobile conserva llaves de `get_image_info` (`status_message`, `total_productos`, `conteo_general`, `acomodo_filas`, `precios`, `detections`, etc.). **Closed**

## 6) Implementation Spec (Atomic)

1. Crear modulo de tipos de contrato en frontend (`ExternalPayload`, `DashboardViewModel`) y bloquear firmas.  
2. Crear adaptador puro que:
   - normalice llaves conocidas del proveedor,
   - aplique defaults,
   - derive KPIs faltantes,
   - active fallback inventado cuando falte informacion critica.
3. Conectar `api.ts` para que devuelva siempre modelo adaptado al dashboard (no JSON crudo).
4. Ajustar `ResultDetailPage` para consumir solo el modelo interno y mantener fallback actual.
5. Agregar fixtures de proveedor (incluyendo typos) para pruebas unitarias del adaptador.
6. Mantener `DashboardPage` sin cambios funcionales de UI en esta fase (solo compatibilidad de datos).
7. En mobile, agregar selector de tienda (5 opciones fijas) y bloquear acciones hasta seleccionar una.
8. En mobile, agregar selector de fuente de imagen (`Camara` o `Archivo`) y soporte de carga `jpg/png`.
9. Implementar servicio para invocar `POST /get_image_info` con `multipart/form-data` (`image_file`) y query params esperados.
10. Implementar transformador mobile para convertir respuesta OCR a contenido Hershey's sin romper estructura JSON del endpoint.
11. Renderizar en mobile el resultado procesado y la tienda seleccionada para validacion operativa.

## 7) Verified Code (Test Plan)

- Unit tests del adaptador:
  - caso feliz con JSON externo completo,
  - caso con typos de proveedor,
  - caso incompleto con fallback inventado,
  - caso invalido con fallback seguro.
- Tests de `api.ts` verificando que la salida al dashboard ya viene adaptada.
- Tests de `ResultDetailPage` validando render de panel y fallback.
- Tests mobile para:
  - bloqueo de procesamiento sin tienda,
  - cambio de fuente camara/archivo,
  - transformacion de respuesta `get_image_info` manteniendo estructura y datos Hershey's.
