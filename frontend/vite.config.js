import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/webhook/dashboard/',
  server: {
    proxy: {
      '/webhook/api': {
        target: 'http://localhost:3550',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:3550',
        changeOrigin: true,
      }
    }
  }
})
