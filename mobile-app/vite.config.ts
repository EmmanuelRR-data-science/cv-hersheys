import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'mobile-app'],
  },
  preview: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'mobile-app'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: "Hershey's CV Mobile",
        short_name: 'Hersheys CV',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#3E000F',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
