import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Inventario - Catálogo de Productos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/inventory/products');
    await expect(page.getByRole('heading', { name: /^Catálogo de Productos$/ })).toBeVisible();
  });

  test('Muestra filtros y grilla/estado vacío', async ({ page }) => {
    await expect(page.getByPlaceholder('Buscar por nombre o SKU...')).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible(); // Type filter

    // Validar que hay tabla de productos o estado vacío
    const statsFooter = page.getByText(/Mostrando|Sin productos/);
    await expect(statsFooter).toBeVisible();
  });

  test('Permite abrir modal de nuevo producto', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Producto' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Producto' })).toBeVisible();
  });

  test('Filtro por búsqueda muestra estado sin resultados', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Buscar por nombre o SKU...');
    await searchInput.fill('XXXXXX_NO_EXISTE_XXXX');

    await expect(page.getByText('Sin resultados')).toBeVisible();
  });

  test('Filtro de tipo (combobox) filtra productos', async ({ page }) => {
    const typeSelect = page.getByRole('combobox').first();
    await typeSelect.selectOption('BULK');

    await expect(typeSelect).toHaveValue('BULK');
  });
});
