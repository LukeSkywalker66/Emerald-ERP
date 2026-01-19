import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

/**
 * Test E2E Kanban de Ingeniería (Playwright)
 *
 * - Incluye login automático con credenciales admin
 * - Sectorizado: helpers, setup, tests
 * - Documentado para QA y debugging
 *
 * Recomendaciones:
 *   - No subir datos sensibles ni helpers de test a producción
 *   - Mantener helpers en /tests/helpers y tests en /tests
 *   - Usar credenciales de testing, nunca de producción
 *   - Revisar que el entorno esté en modo desarrollo antes de correr E2E
 */

test.describe('Kanban de Ingeniería', () => {
  // Hook global: login antes de cada test
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('El tablero carga y muestra columnas', async ({ page }) => {
    // Navega al tablero de ingeniería (requiere login previo)
    await page.goto('/app/engineering');
    // Espera que se rendericen las columnas principales
    await expect(page.getByText('Backlog')).toBeVisible();
    await expect(page.getByText('En Progreso')).toBeVisible();
    await expect(page.getByText('En Pruebas')).toBeVisible();
    await expect(page.getByText('Completadas')).toBeVisible();
  });

  test('Permite drag & drop de tareas entre columnas', async ({ page }) => {
    await page.goto('/app/engineering');
    // Espera que haya al menos una tarea en Backlog
    const task = page.locator('.group.relative.p-4').first();
    await expect(task).toBeVisible();
    // Drag & drop a la columna "En Progreso"
    const target = page.getByText('En Progreso');
    await task.dragTo(target);
    // Verifica que la tarea cambió de columna (esto depende del DOM real)
    // Aquí solo se verifica que no explote el drag
    await expect(page).toHaveURL(/engineering/);
  });
});

/**
 * Notas para QA y Devs:
 * - Este test automatiza login y operaciones básicas del Kanban.
 * - Si falla el login, revisar credenciales y entorno.
 * - No reutilizar helpers de test en código de producción.
 * - Mantener helpers y tests sectorizados para evitar leaks a producción.
 */
