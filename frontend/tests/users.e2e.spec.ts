import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Users - Gestión de Usuarios', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/users');
    await expect(page.getByRole('heading', { name: 'Gestión de Usuarios' })).toBeVisible();
  });

  test('Carga tabla de usuarios y muestra encabezados', async ({ page }) => {
    // Verificar tabla se carga
    await expect(page.getByRole('heading', { name: 'Usuarios del Sistema' })).toBeVisible();
    
    // Verificar encabezados de la tabla usando locators de texto
    await expect(page.locator('th').first()).toBeVisible();
    
    // Validar que los encabezados esperados existen
    const table = page.getByRole('table');
    await expect(table).toContainText('Usuario');
    await expect(table).toContainText('Email');
    await expect(table).toContainText('Estado');
    await expect(table).toContainText('Rol');
  });

  test('Botón "Crear Usuario" abre diálogo', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear Usuario' }).click();
    
    await expect(page.getByRole('heading', { name: 'Crear Nuevo Usuario' })).toBeVisible();
    await expect(page.getByPlaceholder('usuario@emerald.com')).toBeVisible();
  });

  test('Muestra contador de usuarios registrados', async ({ page }) => {
    const description = page.getByText(/usuario[s]? registrado[s]?/);
    await expect(description).toBeVisible();
  });
});
