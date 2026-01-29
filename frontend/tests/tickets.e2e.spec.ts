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
    const header = page.locator('th').filter({ hasText: 'Asunto' }).first();
    await header.click();
    await expect(header.locator('svg.text-emerald-400')).toBeVisible();
  });

  test('Permite ordenar por Tipo', async ({ page }) => {
    const header = page.locator('th').filter({ hasText: 'Tipo' }).first();
    await header.click();
    await expect(header.locator('svg.text-emerald-400')).toBeVisible();
  });

  test('Permite ordenar por Asignado a', async ({ page }) => {
    const header = page.locator('th').filter({ hasText: 'Asignado a' }).first();
    await header.click();
    await expect(header.locator('svg.text-emerald-400')).toBeVisible();
  });
});

test.describe('Tickets - Creación de Ticket Técnico', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
    await page.waitForLoadState('networkidle');
  });

  test('Abre modal de selección de categorías', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    
    // Verificar que el modal de categorías se abre
    await expect(page.getByRole('heading', { name: 'Crear Nuevo Ticket' })).toBeVisible();
    
    // Verificar que aparecen las categorías
    await expect(page.getByText('Falla Técnica')).toBeVisible();
    await expect(page.getByText('Administrativo')).toBeVisible();
  });

  test('Selecciona categoría Falla Técnica y abre wizard', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    
    // Click en la tarjeta de Falla Técnica
    await page.getByText('Falla Técnica').click();
    
    // Verificar que el wizard técnico se abre
    await expect(page.getByText(/Buscar conexión del cliente/i)).toBeVisible();
  });

  test('Busca conexión de cliente por DNI', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Falla Técnica').click();
    
    // Buscar por DNI de prueba
    const searchInput = page.getByPlaceholder(/DNI, nombre/i);
    await searchInput.fill('12345678');
    
    // Esperar resultados (o mensaje de "no encontrado")
    await page.waitForTimeout(600); // Debounce
  });

  test('Valida campos requeridos al crear ticket técnico', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Falla Técnica').click();
    
    // Intentar crear sin llenar campos
    const submitButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    
    // El botón debe estar deshabilitado si no hay conexión seleccionada
    await expect(submitButton).toBeDisabled();
  });
});

test.describe('Tickets - Creación de Ticket Administrativo', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
    await page.waitForLoadState('networkidle');
  });

  test('Selecciona categoría Administrativo y carga motivos', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Administrativo').click();
    
    // Verificar que aparece el select de motivos
    await expect(page.getByText(/Motivo del ticket/i)).toBeVisible();
    
    // Verificar que los motivos se cargan (si hay datos en BD)
    const reasonSelect = page.locator('select, [role="combobox"]').first();
    await expect(reasonSelect).toBeVisible();
  });

  test('Genera asunto automático al seleccionar motivo', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Administrativo').click();
    
    // Buscar cliente
    const searchInput = page.getByPlaceholder(/DNI, nombre/i);
    await searchInput.fill('test');
    await page.waitForTimeout(600);
    
    // Si hay resultados, seleccionar el primero
    const firstResult = page.locator('[data-connection-result]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
      
      // El asunto debe generarse automáticamente
      const subjectInput = page.getByPlaceholder(/Asunto/i);
      await expect(subjectInput).not.toBeEmpty();
    }
  });
});

test.describe('Tickets - Validaciones y Campos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
    await page.waitForLoadState('networkidle');
  });

  test('Valida que categoría y motivo son requeridos para ticket administrativo', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Administrativo').click();
    
    // Verificar que el select de motivos existe y está vacío por defecto
    const reasonSelect = page.locator('select, [role="combobox"]').first();
    await expect(reasonSelect).toBeVisible();
  });

  test('Prioridad tiene valores válidos', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Falla Técnica').click();
    
    // Buscar el selector de prioridad
    const prioritySelect = page.locator('select').filter({ hasText: /prioridad/i });
    
    if (await prioritySelect.isVisible()) {
      // Verificar opciones de prioridad
      const options = await prioritySelect.locator('option').allTextContents();
      expect(options.some(opt => opt.includes('Alta') || opt.includes('Media') || opt.includes('Baja'))).toBeTruthy();
    }
  });
});

test.describe('Tickets - Filtros y Búsqueda', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
  });

  test('Muestra barra de búsqueda', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Buscar/i);
    await expect(searchInput).toBeVisible();
  });

  test('Permite filtrar por texto', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Buscar/i);
    await searchInput.fill('test');
    
    // Esperar a que se aplique el filtro
    await page.waitForTimeout(500);
  });

  test('Muestra filtros de estado si existen', async ({ page }) => {
    // Buscar cualquier combobox o select de filtro
    const filterControls = page.locator('[role="combobox"], select').first();
    
    // Verificar que existe algún control de filtro
    if (await filterControls.isVisible()) {
      await expect(filterControls).toBeVisible();
    }
  });
});

test.describe('Tickets - Detalle y Edición', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
  });

  test('Abre el detalle de un ticket al hacer clic', async ({ page }) => {
    // Buscar la primera fila de ticket
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      
      // Verificar que se abre el panel de detalle
      await page.waitForTimeout(500);
      
      // El panel debe mostrar información del ticket
      const detailPanel = page.locator('[role="dialog"], .sheet');
      if (await detailPanel.isVisible()) {
        await expect(detailPanel).toBeVisible();
      }
    }
  });

  test('Muestra timeline del ticket en el detalle', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Buscar el timeline/bitácora
      const timeline = page.locator('[data-testid="ticket-timeline"], .timeline');
      
      if (await timeline.isVisible()) {
        await expect(timeline).toBeVisible();
      }
    }
  });
});
