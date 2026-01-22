import { defineConfig, loadEnv } from 'vite' // 👈 Importamos loadEnv
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// Cambiamos a función para poder leer las variables de entorno (mode)
export default defineConfig(({ mode }) => {
  // Carga variables de entorno (como VITE_API_URL) del sistema o archivo .env
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      allowedHosts: true,
      
      // 👇 SECCIÓN PROXY AGREGADA
      proxy: {
        '/api': {
          // Si estamos en Docker, usa la variable. Si es local, usa localhost:8500
          target: env.INTERNAL_API_URL || 'http://localhost:8500',
          changeOrigin: true,
          secure: false,
                  },
      },
      // 👆 FIN SECCIÓN PROXY

      hmr: {
        host: process.env.HMR_HOST || undefined,
        protocol: 'wss',
        clientPort: 443,
      },
    }
  }
})