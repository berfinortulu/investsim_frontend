import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Network üzerinden erişime açık
    strictPort: true, // Port meşgulse hata ver
    open: true, // Browser'ı otomatik aç
    cors: true, // CORS desteği
    proxy: {
      // Backend API proxy ayarı
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
