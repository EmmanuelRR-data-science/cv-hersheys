# Dashboard (Hershey's CV)

Aplicacion React + TypeScript para analistas. Muestra resultados de procesamiento, filtros y detalle con panel de ventas.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run test:run
```

## Flujo de datos actual

- Cliente API: `src/services/api.ts`
- Adaptacion de payload externo: `src/services/resultAdapter.ts`
- Tipos de resultado: `src/services/resultTypes.ts`

El dashboard no depende directamente del JSON crudo del proveedor. El service layer normaliza a un modelo estable de `sales` y aplica fallback inventado cuando faltan datos.

## Pruebas clave

- `src/services/resultAdapter.test.ts`
- `src/services/api.test.ts`
- `src/routes/ResultDetailPage.test.tsx`
