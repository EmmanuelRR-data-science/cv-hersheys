import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'dashboard'],
  },
  preview: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'dashboard'],
  },
  plugins: [
    react(),
    {
      name: 'health-endpoint',
      configureServer(server) {
        server.middlewares.use('/health', (req, res, next) => {
          if (req.method && req.method !== 'GET') return next()
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ status: 'ok' }))
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use('/health', (req, res, next) => {
          if (req.method && req.method !== 'GET') return next()
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ status: 'ok' }))
        })
      },
    },
  ],
})
