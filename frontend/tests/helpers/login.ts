// helpers/login.ts
// Helper para login automático en tests E2E (Playwright)
// Uso: await login(page, { email, password })

import { Page } from '@playwright/test';

export async function login(page: Page, {
  email = 'admin@emerald.com',
  password = 'Admin@123',
} = {}) {
  //await page.goto('http://localhost:5173/login');
  await page.goto('/login');
  await page.fill('input#username', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  // Espera navegación a /app
  await page.waitForURL('**/app/**');
}
