import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? 'localhost,127.0.0.1,dashboard')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts,
  },
  preview: {
    host: true,
    allowedHosts,
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
