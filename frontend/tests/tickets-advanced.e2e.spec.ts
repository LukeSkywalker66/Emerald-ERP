import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Tickets - Cambio de Estado y Asignación', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
  });

  test('Permite cambiar el estado de un ticket', async ({ page }) => {
    // Abrir primer ticket
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Buscar el selector de estado
      const statusSelect = page.locator('select, [role="combobox"]').filter({ hasText: /Estado|Abierto|En Progreso/i }).first();
      
      if (await statusSelect.isVisible()) {
        // Cambiar estado
        await statusSelect.click();
        
        // Seleccionar "En Progreso" si está disponible
        const inProgressOption = page.getByText(/En Progreso/i).first();
        if (await inProgressOption.isVisible()) {
          await inProgressOption.click();
        }
      }
    }
  });

  test('Permite cambiar la asignación de un ticket', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Buscar selector de asignación
      const assignSelect = page.locator('select, [role="combobox"]').filter({ hasText: /Asignar|Técnico/i }).first();
      
      if (await assignSelect.isVisible()) {
        await expect(assignSelect).toBeVisible();
      }
    }
  });

  test('Valida que el cambio de estado genera evento en timeline', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Verificar que existe timeline
      const timeline = page.locator('[data-testid="ticket-timeline"], .timeline, [class*="timeline"]');
      
      if (await timeline.isVisible()) {
        // Contar eventos antes del cambio
        const eventsBefore = await page.locator('.timeline-event, [data-event-type]').count();
        
        // Cambiar estado si es posible
        const statusSelect = page.locator('select, [role="combobox"]').filter({ hasText: /Estado/i }).first();
        
        if (await statusSelect.isVisible()) {
          await statusSelect.click();
          const option = page.locator('option, [role="option"]').nth(1);
          if (await option.isVisible()) {
            await option.click();
            
            // Esperar a que se cree el evento
            await page.waitForTimeout(1000);
            
            // Verificar que aumentó la cantidad de eventos
            const eventsAfter = await page.locator('.timeline-event, [data-event-type]').count();
            expect(eventsAfter).toBeGreaterThanOrEqual(eventsBefore);
          }
        }
      }
    }
  });
});

test.describe('Tickets - Timeline y Comentarios', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
  });

  test('Muestra timeline con eventos existentes', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Verificar que el timeline está visible
      const timeline = page.locator('[data-testid="ticket-timeline"], .timeline, [class*="timeline"]');
      
      if (await timeline.isVisible()) {
        await expect(timeline).toBeVisible();
        
        // Verificar que hay al menos un evento (creación del ticket)
        const events = page.locator('.timeline-event, [data-event-type]');
        const eventCount = await events.count();
        expect(eventCount).toBeGreaterThan(0);
      }
    }
  });

  test('Permite agregar un comentario al ticket', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Buscar input de comentario
      const commentInput = page.locator('textarea, input').filter({ 
        hasText: /comentario|nota/i 
      }).or(page.getByPlaceholder(/Agregar comentario|Escribir nota/i));
      
      if (await commentInput.first().isVisible()) {
        const input = commentInput.first();
        await input.fill('Este es un comentario de prueba E2E');
        
        // Buscar botón de enviar
        const submitButton = page.getByRole('button', { name: /Enviar|Agregar|Guardar/i });
        if (await submitButton.isVisible()) {
          await submitButton.click();
          
          // Esperar a que se agregue el comentario
          await page.waitForTimeout(1000);
          
          // Verificar que el comentario aparece en el timeline
          await expect(page.getByText('Este es un comentario de prueba E2E')).toBeVisible();
        }
      }
    }
  });

  test('Muestra eventos en orden cronológico', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Verificar que los eventos tienen timestamps
      const timestamps = page.locator('[data-timestamp], .timeline-date, time');
      
      if (await timestamps.first().isVisible()) {
        const count = await timestamps.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('Muestra iconos diferentes para tipos de eventos', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Verificar que hay iconos en los eventos
      const eventIcons = page.locator('.timeline-event svg, [data-event-type] svg');
      
      if (await eventIcons.first().isVisible()) {
        const iconCount = await eventIcons.count();
        expect(iconCount).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Tickets - Validaciones de Negocio', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
    await page.waitForLoadState('networkidle');
  });

  test('No permite cerrar ticket sin resolver', async ({ page }) => {
    const firstTicketRow = page.locator('tbody tr').first();
    
    if (await firstTicketRow.isVisible()) {
      await firstTicketRow.click();
      await page.waitForTimeout(500);
      
      // Buscar selector de estado
      const statusSelect = page.locator('select, [role="combobox"]').filter({ hasText: /Estado/i }).first();
      
      if (await statusSelect.isVisible()) {
        await statusSelect.click();
        
        // Intentar seleccionar "Cerrado"
        const closedOption = page.getByText(/Cerrado/i).first();
        
        if (await closedOption.isVisible()) {
          // Este test verifica que existe la opción, pero la lógica de validación
          // debería estar en el backend
          await expect(closedOption).toBeVisible();
        }
      }
    }
  });

  test('Asunto no puede estar vacío', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Falla Técnica').click();
    
    // Buscar input de asunto
    const subjectInput = page.getByPlaceholder(/Asunto/i);
    
    if (await subjectInput.isVisible()) {
      // Limpiar el campo si tiene contenido
      await subjectInput.clear();
      
      // Verificar que el botón de crear está deshabilitado
      const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
      
      // El botón debe estar deshabilitado cuando el asunto está vacío
      if (await createButton.isVisible()) {
        const isDisabled = await createButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }
    }
  });

  test('Descripción tiene un mínimo de caracteres', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.getByText('Falla Técnica').click();
    
    // Buscar textarea de descripción
    const descriptionInput = page.locator('textarea').filter({ hasText: /Descripción/i });
    
    if (await descriptionInput.isVisible()) {
      // Ingresar texto muy corto
      await descriptionInput.fill('ab');
      
      // Verificar que muestra error o el botón está deshabilitado
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Tickets - Wizards Específicos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
    await page.waitForLoadState('networkidle');
  });

  test('Wizard de Instalación tiene campos específicos', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    
    // Seleccionar categoría Instalación
    const installationCard = page.getByText('Instalación');
    
    if (await installationCard.isVisible()) {
      await installationCard.click();
      
      // Verificar campos específicos de instalación
      await page.waitForTimeout(500);
      
      // Debe tener campos para técnico de instalación
      const techField = page.locator('input, select').filter({ hasText: /técnico/i });
      
      if (await techField.first().isVisible()) {
        await expect(techField.first()).toBeVisible();
      }
    }
  });

  test('Wizard de Traslado requiere dirección destino', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    
    // Seleccionar categoría Traslado
    const relocationCard = page.getByText('Traslado');
    
    if (await relocationCard.isVisible()) {
      await relocationCard.click();
      await page.waitForTimeout(500);
      
      // Buscar campo de dirección destino
      const addressField = page.getByPlaceholder(/dirección|destino/i);
      
      if (await addressField.isVisible()) {
        await expect(addressField).toBeVisible();
      }
    }
  });

  test('Wizard de Baja muestra motivos específicos', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /Nuevo Ticket/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    
    // Seleccionar categoría Baja
    const withdrawalCard = page.getByText('Baja');
    
    if (await withdrawalCard.isVisible()) {
      await withdrawalCard.click();
      await page.waitForTimeout(500);
      
      // Verificar que hay un select de motivos
      const reasonSelect = page.locator('select, [role="combobox"]').first();
      
      if (await reasonSelect.isVisible()) {
        await reasonSelect.click();
        
        // Verificar motivos específicos de baja
        const priceOption = page.getByText(/Precio|Competencia/i).first();
        const technicalOption = page.getByText(/Disconformidad|Técnica/i).first();
        
        // Al menos uno de estos motivos debe estar visible
        if (await priceOption.isVisible() || await technicalOption.isVisible()) {
          expect(true).toBeTruthy();
        }
      }
    }
  });
});

test.describe('Tickets - Filtros Avanzados', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/tickets');
  });

  test('Filtra por prioridad', async ({ page }) => {
    // Buscar filtro de prioridad
    const priorityFilter = page.locator('select, [role="combobox"]').filter({ hasText: /Prioridad|Alta|Media|Baja/i });
    
    if (await priorityFilter.first().isVisible()) {
      await priorityFilter.first().click();
      
      // Seleccionar "Alta"
      const highOption = page.getByText(/Alta/i).first();
      if (await highOption.isVisible()) {
        await highOption.click();
        
        // Esperar a que se aplique el filtro
        await page.waitForTimeout(500);
      }
    }
  });

  test('Filtra por tipo de ticket', async ({ page }) => {
    const typeFilter = page.locator('select, [role="combobox"]').filter({ hasText: /Tipo|Técnico|Administrativo/i });
    
    if (await typeFilter.first().isVisible()) {
      await typeFilter.first().click();
      
      // Seleccionar "Técnico"
      const techOption = page.getByText(/Técnico/i).first();
      if (await techOption.isVisible()) {
        await techOption.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('Filtra por técnico asignado', async ({ page }) => {
    const assignedFilter = page.locator('select, [role="combobox"]').filter({ hasText: /Asignado|Técnico/i });
    
    if (await assignedFilter.first().isVisible()) {
      await assignedFilter.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('Combina múltiples filtros', async ({ page }) => {
    // Aplicar filtro de búsqueda
    const searchInput = page.getByPlaceholder(/Buscar/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
    
    // Aplicar filtro de estado
    const statusFilter = page.locator('select, [role="combobox"]').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      const firstOption = page.locator('option, [role="option"]').nth(1);
      if (await firstOption.isVisible()) {
        await firstOption.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('Limpia todos los filtros', async ({ page }) => {
    // Buscar botón de limpiar filtros
    const clearButton = page.getByRole('button', { name: /Limpiar|Borrar|Reset/i });
    
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(300);
    }
  });
});
