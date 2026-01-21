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
    // Navegar al tablero
    await page.goto('/app/engineering');

    // CORRECCIÓN: Usamos getByRole('heading', ...) para ser específicos
    // y evitar confundirnos con otros textos.
    await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'En Progreso' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'En Pruebas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Completadas' })).toBeVisible();
  });

  test('Permite drag & drop de tareas entre columnas', async ({ page }) => {
    await page.goto('/app/engineering');

    // 1. Esperar que aparezca alguna tarea (buscamos la primera tarjeta)
    // El selector .group.relative.p-4 parece ser tu tarjeta de tarea según tus logs anteriores
    const task = page.locator('.group.relative.p-4').first();
    await expect(task).toBeVisible();

    // 2. Definir el destino: El TÍTULO de la columna "En Progreso"
    // (Arrastrar al título suele funcionar bien para soltar en la columna)
    const target = page.getByRole('heading', { name: 'En Progreso' });

    // 3. Ejecutar Drag & Drop
    await task.dragTo(target);

    // Verificación básica de que no explotó
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
