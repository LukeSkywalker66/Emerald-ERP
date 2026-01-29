import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Tickets - Listado y ordenamiento', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
    await expect(page.getByRole('heading', { name: 'Gestión de Tickets' })).toBeVisible();
    await expect(page.locator('thead')).toBeVisible();
  });

  test('Permite ordenar por Asunto', async ({ page }) => {
    // Buscar por el texto dentro del columnheader
    const header = page.locator('th').filter({ hasText: 'Asunto' }).first();
    await header.click();

    // Icono activo (flecha verde) indica que el ordenamiento se aplicó
    await expect(header.locator('svg.text-emerald-400')).toBeVisible();
  });

  test('Permite ordenar por Tipo', async ({ page }) => {
    // Buscar por el texto dentro del columnheader
    const header = page.locator('th').filter({ hasText: 'Tipo' }).first();
    await header.click();

    // Icono activo (flecha verde) indica que el ordenamiento se aplicó
    await expect(header.locator('svg.text-emerald-400')).toBeVisible();
  });

  test('Permite ordenar por Asignado a', async ({ page }) => {
    // Buscar por el texto dentro del columnheader
    const header = page.locator('th').filter({ hasText: 'Asignado a' }).first();
    await header.click();

    // Icono activo (flecha verde) indica que el ordenamiento se aplicó
    await expect(header.locator('svg.text-emerald-400')).toBeVisible();
  });
});
