import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Inventario - Almacenes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/inventory/warehouses');
    await expect(page.getByRole('heading', { name: /^Almacenes$/ })).toBeVisible();
  });

  test('Muestra filtros y grilla/estado vacío', async ({ page }) => {
    await expect(page.getByPlaceholder('Buscar por nombre...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CENTRAL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MOBILE' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'VIRTUAL' })).toBeVisible();

    const emptyState = page.getByText('Sin almacenes');
    const resultsState = page.getByText('Mostrando');

    await expect(emptyState.or(resultsState)).toBeVisible();
  });

  test('Permite abrir el modal de nuevo almacén', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Almacén' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Almacén' })).toBeVisible();
  });

  test('Filtro por búsqueda muestra estado de sin resultados', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Buscar por nombre...');
    await searchInput.fill('ZZZ_NO_EXISTE_12345');

    await expect(page.getByText('Sin resultados')).toBeVisible();
    await expect(page.getByText('No se encontraron almacenes con los filtros aplicados')).toBeVisible();
  });
});
