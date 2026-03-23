// helpers/login.ts
// helpers/login.ts
import { Page, expect } from '@playwright/test';

declare const process: {
  env: Record<string, string | undefined>;
};

type LoginOptions = {
  email?: string;
  password?: string;
};

export async function login(
  page: Page,
  {
    email = process.env.E2E_ADMIN_EMAIL || 'admin@emerald.com',
    password = process.env.E2E_ADMIN_PASSWORD || 'Admin123',
  }: LoginOptions = {}
) {
  await page.goto('/login');
  await page.fill('input#username', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/app/);
}

export async function loginAsTechnician(page: Page, options: LoginOptions = {}) {
  const email = options.email || process.env.E2E_TECH_EMAIL || 'tecnico2@emerald.com';
  const password = options.password || process.env.E2E_TECH_PASSWORD || 'Admin123';
  await login(page, { email, password });
}

export async function loginAsOperator(page: Page, options: LoginOptions = {}) {
  const email = options.email || process.env.E2E_OPERATOR_EMAIL || 'operador1@emerald.com';
  const password = options.password || process.env.E2E_OPERATOR_PASSWORD || 'Admin123';
  await login(page, { email, password });
}
