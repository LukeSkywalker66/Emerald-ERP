import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // CLAVE: El punto '.' significa "buscá acá mismo", en /app
  testDir: '.', 
  // Nos aseguramos que busque archivos que terminen en .spec.ts
  testMatch: /.*\.e2e\.spec\.ts/, 
  
  // Resto de tu config...
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173', // Ojo: Que apunte al nombre del servicio en docker-compose
    //trace: 'on-first-retry',
    screenshot: 'on', // Saca foto de cada paso
    trace: 'retain-on-failure', // Guarda un video/traza si falla
  },
});