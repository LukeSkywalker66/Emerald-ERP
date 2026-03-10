import { test, expect } from '@playwright/test';
import { login, loginAsTechnician } from './helpers/login';

test.describe('Inventario - Almacenes (Admin/Operator)', () => {
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

test.describe('RBAC Logística - Técnico', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.E2E_TECH_EMAIL || !process.env.E2E_TECH_PASSWORD,
      'Definir E2E_TECH_EMAIL y E2E_TECH_PASSWORD para ejecutar pruebas RBAC de técnico.'
    );

    await loginAsTechnician(page);
  });

  test('Sidebar logística muestra solo Almacenes y Flota', async ({ page }) => {
    await page.goto('/app/work-orders');

    await expect(page.getByRole('link', { name: 'Almacenes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Flota' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Catálogo' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Operaciones' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Auditoría' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Alertas' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('Técnico accede a almacenes y flota en modo consulta', async ({ page }) => {
    await page.goto('/app/inventory/warehouses');
    await expect(page.getByRole('heading', { name: /^Almacenes$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo Almacén' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Todos' })).toHaveCount(0);

    await page.goto('/app/fleet');
    await expect(page.getByRole('heading', { name: /Módulo de Flota/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nuevo Vehículo/i })).toHaveCount(0);
  });

  test('Rutas administrativas de logística redirigen a /app/inventory/warehouses', async ({ page }) => {
    const deniedRoutes = [
      '/app/inventory',
      '/app/inventory/products',
      '/app/inventory/transfer',
      '/app/inventory/movements',
      '/app/inventory/alerts',
    ];

    for (const path of deniedRoutes) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/app\/inventory\/warehouses/);
      await expect(page.getByRole('heading', { name: /^Almacenes$/ })).toBeVisible();
    }
  });
});
