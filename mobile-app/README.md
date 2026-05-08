# Mobile App (Hershey's CV)

Aplicacion movil (PWA) para captura y subida de imagenes al backend.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run test:run
```

## Funcionalidad principal

- Captura de imagen desde camara.
- Compresion previa a carga.
- Subida con progreso.
- Cola offline y reintentos automaticos.

## Integracion

- API client: `src/services/api.ts`
- Upload hook: `src/hooks/useUpload.ts`
- Offline queue: `src/hooks/useOffline.ts`
