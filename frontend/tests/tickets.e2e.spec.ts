import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Tickets - Listado y ordenamiento', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
    await expect(page.getByRole('heading', { name: 'Gestión de Tickets' })).toBeVisible();
  });

  test('Permite ordenar por Asunto', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: 'Asunto' });
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes('/api/v2/tickets') &&
        res.url().includes('order_by=subject') &&
        res.status() === 200
      ),
      header.click(),
    ]);

    expect(response.ok()).toBeTruthy();
  });

  test('Permite ordenar por Tipo', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: 'Tipo' });
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes('/api/v2/tickets') &&
        res.url().includes('order_by=ticket_type') &&
        res.status() === 200
      ),
      header.click(),
    ]);

    expect(response.ok()).toBeTruthy();
  });

  test('Permite ordenar por Asignado a', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: 'Asignado a' });
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes('/api/v2/tickets') &&
        res.url().includes('order_by=assigned_to_name') &&
        res.status() === 200
      ),
      header.click(),
    ]);

    expect(response.ok()).toBeTruthy();
  });
});
