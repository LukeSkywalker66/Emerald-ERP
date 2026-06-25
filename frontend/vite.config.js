import { defineConfig, loadEnv } from 'vite' // 👈 Importamos loadEnv
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const packageJsonPath = path.resolve(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const appVersion = packageJson.version || '0.0.0';

// https://vite.dev/config/
// Cambiamos a función para poder leer las variables de entorno (mode)
export default defineConfig(({ mode }) => {
  // Carga variables de entorno desde la raíz del proyecto (no desde frontend/)
  // para que cada entorno tenga su propio .env con APP_ENV y VITE_APP_ENV.
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
       
    // 🛡️ Source maps controlados por entorno:
    //   - Por defecto (npm run build) → false (seguro para producción)
    //   - npm run build:debug → true (source maps para debugging)
    build: {
      sourcemap: process.env.VITE_ENABLE_SOURCEMAPS === 'true',
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