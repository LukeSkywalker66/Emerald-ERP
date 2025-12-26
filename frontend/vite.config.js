import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // Escuchar en 0.0.0.0 (Para Docker)
    allowedHosts: true // 👈 LA CLAVE: Permitir cualquier dominio (emerald.2finternet.ar)
  }
})
