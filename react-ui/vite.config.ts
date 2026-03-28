import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
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
