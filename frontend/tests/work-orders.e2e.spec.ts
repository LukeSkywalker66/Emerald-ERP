import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Work Orders - Listado y navegación', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/work-orders');
    await expect(page.getByRole('heading', { name: /Órdenes de Trabajo|Mis Órdenes Asignadas/ })).toBeVisible();
  });

  test('Muestra grilla o estado vacío', async ({ page }) => {
    const emptyState = page.getByText('No se encontraron órdenes de trabajo');
    const table = page.locator('table');

    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
      return;
    }

    await expect(table).toBeVisible();
  });

  test('Abre detalle al hacer clic en una OT', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      await expect(page.getByText('No se encontraron órdenes de trabajo')).toBeVisible();
      return;
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/app\/work-orders\/\d+\/execute/);
    await expect(page.getByText(/Ticket #\d+/)).toBeVisible();
  });
});
