import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', // Detecta todos los tests en el directorio actual
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
});
