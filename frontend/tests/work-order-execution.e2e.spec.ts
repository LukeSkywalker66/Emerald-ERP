import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/login';

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

async function openFirstWorkOrderExecution(page: Page) {
  await login(page);
  await page.goto('/app/work-orders');
  await expect(page.getByRole('heading', { name: /Órdenes de Trabajo|Mis Órdenes Asignadas/ })).toBeVisible();

  const emptyState = page.getByText('No se encontraron órdenes de trabajo');
  if (await emptyState.isVisible()) {
    return null;
  }

  const rows = page.locator('tbody tr');
  const rowCount = await rows.count();
  if (rowCount === 0) {
    return null;
  }

  const detailResponsePromise = page.waitForResponse((res) => {
    if (res.request().method() !== 'GET') return false;
    if (res.status() !== 200) return false;

    try {
      const path = new URL(res.url()).pathname;
      return /\/v2\/work-orders\/\d+$/.test(path);
    } catch {
      return false;
    }
  });

  await rows.first().click();
  await expect(page).toHaveURL(/\/app\/work-orders\/\d+\/execute/);

  const detailResponse = await detailResponsePromise;
  const workOrder = await detailResponse.json();

  return workOrder;
}

test.describe('Work Orders - Ejecución OT crítica', () => {
  test('Detalle muestra asignación y criticidad coherentes con backend', async ({ page }) => {
    const workOrder = await openFirstWorkOrderExecution(page);

    test.skip(!workOrder, 'No hay OTs disponibles para validar detalle de ejecución');

    const expectedAssignment = workOrder.team_name || workOrder.technician_name || 'sin asignar';
    const expectedPriorityKey = String(
      workOrder.ticket_info?.priority || workOrder.priority || 'medium'
    ).toLowerCase();
    const expectedPriorityLabel = PRIORITY_LABELS[expectedPriorityKey] || PRIORITY_LABELS.medium;

    await expect(page.locator('p', { hasText: 'Asignada a:' })).toContainText(expectedAssignment);
    await expect(page.getByText(`Criticidad: ${expectedPriorityLabel}`)).toBeVisible();
  });

  test('Modal Agregar Material no cierra por Escape ni click afuera', async ({ page }) => {
    const workOrder = await openFirstWorkOrderExecution(page);

    test.skip(!workOrder, 'No hay OTs disponibles para validar modal de materiales');

    const addMaterialButton = page.getByRole('button', { name: 'Agregar Material' });
    const disabled = await addMaterialButton.isDisabled();
    test.skip(disabled, 'La OT está completada y no permite abrir modal de materiales');

    await addMaterialButton.click();
    await expect(page.getByRole('heading', { name: 'Agregar Material' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Agregar Material' })).toBeVisible();

    await page.locator('div.absolute.inset-0').first().click({ force: true });
    await expect(page.getByRole('heading', { name: 'Agregar Material' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).first().click();
    await expect(page.getByRole('heading', { name: 'Agregar Material' })).not.toBeVisible();
  });

  test('Wizard Completar OT no cierra por Escape ni click afuera', async ({ page }) => {
    const workOrder = await openFirstWorkOrderExecution(page);

    test.skip(!workOrder, 'No hay OTs disponibles para validar wizard de cierre');

    const completeButton = page.getByRole('button', { name: 'Completar' });
    const visible = await completeButton.isVisible();
    test.skip(!visible, 'La OT no está en progreso, no se puede abrir wizard de cierre');

    await completeButton.click();
    await expect(page.getByRole('heading', { name: 'Completar Orden de Trabajo' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Completar Orden de Trabajo' })).toBeVisible();

    await page.locator('div.absolute.inset-0').first().click({ force: true });
    await expect(page.getByRole('heading', { name: 'Completar Orden de Trabajo' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).first().click();
    await expect(page.getByRole('heading', { name: 'Completar Orden de Trabajo' })).not.toBeVisible();
  });
});
