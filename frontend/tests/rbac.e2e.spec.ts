/**
 * RBAC E2E — Fase 1: visibilidad de módulos por rol.
 *
 * Requiere los usuarios de prueba creados por:
 *   backend/scripts/seed_rbac_test_users.py
 *
 * Credenciales configurables por variables de entorno:
 *   E2E_RBAC_ADMIN_EMAIL / E2E_RBAC_PASSWORD
 *   E2E_RBAC_OPERATOR_EMAIL
 *   E2E_RBAC_TECH_EMAIL
 *
 * Semántica: un ítem de menú "es accesible" para un rol si está renderizado
 * en el DOM del sidebar (no filtrado por RBAC). Los grupos colapsados siguen
 * renderizando sus items (ocultos por CSS), por lo que `toHaveCount(1)` =
 * accesible y `toHaveCount(0)` = denegado.
 */
import { test, expect, type Page } from '@playwright/test';

const PASSWORD = process.env.E2E_RBAC_PASSWORD || 'Admin123';

const CREDENTIALS = {
  admin: {
    email: process.env.E2E_RBAC_ADMIN_EMAIL || 'rbac.admin@emerald.test',
    password: PASSWORD,
  },
  operator: {
    email: process.env.E2E_RBAC_OPERATOR_EMAIL || 'rbac.operator@emerald.test',
    password: PASSWORD,
  },
  technician: {
    email: process.env.E2E_RBAC_TECH_EMAIL || 'rbac.technician@emerald.test',
    password: PASSWORD,
  },
};

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('input#username', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app/);
}

// Link de menú por nombre visible (texto único en el sidebar).
const linkByName = (page: Page, name: string) =>
  page.getByRole('link', { name, exact: true });

// Link por href (para nombres duplicados como "Auditoría": logística vs sistema).
const linkByHref = (page: Page, href: string) =>
  page.locator(`a[href="${href}"]`);

test.describe('RBAC: visibilidad de módulos por rol', () => {
  test('admin ve dashboard, tickets y módulos de solo-admin', async ({ page }) => {
    await login(page, CREDENTIALS.admin);

    await expect(linkByName(page, 'Dashboard')).toHaveCount(1);
    await expect(linkByName(page, 'Tickets')).toHaveCount(1);
    await expect(linkByName(page, 'Coordinación')).toHaveCount(1);
    await expect(linkByHref(page, '/app/audit')).toHaveCount(1); // Auditoría del sistema
  });

  test('operador ve módulos operativos pero NO auditoría del sistema', async ({ page }) => {
    await login(page, CREDENTIALS.operator);

    await expect(linkByName(page, 'Dashboard')).toHaveCount(1);
    await expect(linkByName(page, 'Tickets')).toHaveCount(1);
    await expect(linkByName(page, 'Coordinación')).toHaveCount(1);
    await expect(linkByHref(page, '/app/audit')).toHaveCount(0); // solo admin
  });

  test('tecnico ve solo su ruta y no módulos de gestión', async ({ page }) => {
    await login(page, CREDENTIALS.technician);

    await expect(linkByName(page, 'Tickets')).toHaveCount(1);
    await expect(linkByName(page, 'Órdenes de Trabajo')).toHaveCount(1);

    await expect(linkByName(page, 'Dashboard')).toHaveCount(0);
    await expect(linkByName(page, 'Coordinación')).toHaveCount(0);
    await expect(linkByHref(page, '/app/engineering')).toHaveCount(0);
    await expect(linkByHref(page, '/app/audit')).toHaveCount(0);
  });
});
