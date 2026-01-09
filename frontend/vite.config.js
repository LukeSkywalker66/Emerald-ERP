import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,        // Escuchar en 0.0.0.0 (Para Docker)
    allowedHosts: true, // 👈 LA CLAVE: Permitir cualquier dominio (emerald.2finternet.ar)
    hmr: {
      // HMR dinámico: usa dominio actual si no se define HMR_HOST
      host: process.env.HMR_HOST || undefined,
      protocol: 'wss',
      clientPort: 443,
    },
  }
})
