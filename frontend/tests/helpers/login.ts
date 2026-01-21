// helpers/login.ts
// helpers/login.ts
import { Page, expect } from '@playwright/test'; // 👈 Importar expect es clave

export async function login(page: Page, {
  email = 'admin@emerald.com',
  password = 'Admin@123',
} = {}) {
  await page.goto('/login');
  await page.fill('input#username', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');

  // CORRECCIÓN: Usamos expect con Regex.
  // Esto detecta "/app" aunque no tenga barra al final.
  await expect(page).toHaveURL(/\/app/); 
}