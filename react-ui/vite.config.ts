import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 so http://127.0.0.1:5173 works (default [::1] breaks that URL on some systems).
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Same host as /api so scanner_sid cookie applies to main API, scanner, and OAuth.
      '/scanner': {
        target: 'http://127.0.0.1:9010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scanner/, ''),
      },
      '/oauth': {
        target: 'http://127.0.0.1:9020',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oauth/, ''),
      },
    },
  },
})
