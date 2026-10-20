import { test, expect, type Page, type APIResponse } from '@playwright/test';
import { login } from './helpers/login';

/**
 * Cobertura del flujo de consumibles BULK (no serializados) en el wizard de
 * entrega de materiales:
 *
 * 1. El buscador de stock muestra la cantidad disponible por unidad.
 * 2. Al seleccionar un BULK, el backend persiste un item con cantidad.
 * 3. La cantidad puede editarse y se valida contra el stock del depósito origen.
 *
 * Los tests de integración API se saltan si el entorno no dispone de los
 * prerequisitos (cuadrilla activa, depósito central y producto BULK con stock).
 */

async function jsonArray(res: APIResponse): Promise<any[]> {
  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

interface DeliveryContext {
  central: any;
  team: any;
  mobile: any;
}

async function findDeliveryContext(page: Page): Promise<DeliveryContext | null> {
  const whRes = await page.request.get('/v2/inventory/warehouses');
  if (!whRes.ok()) return null;
  const warehouses = await jsonArray(whRes);

  const central = warehouses.find((w) => w.type === 'CENTRAL' || w.type === 'AUXILIAR');
  if (!central) return null;

  const teamsRes = await page.request.get('/v2/coordination/teams?active_only=true');
  if (!teamsRes.ok()) return null;
  const teams = await jsonArray(teamsRes);

  const mobileByVehicle = new Map<number, any>();
  for (const w of warehouses) {
    if (w.type === 'MOBILE' && w.vehicle?.id) {
      mobileByVehicle.set(w.vehicle.id, w);
    }
  }

  const team = teams.find(
    (t) => t.is_active !== false && t.vehicle_id && mobileByVehicle.has(t.vehicle_id)
  );
  if (!team) return null;

  const mobile = mobileByVehicle.get(team.vehicle_id);
  return { central, team, mobile };
}

async function findBulkProduct(page: Page, warehouseId: number): Promise<any | null> {
  const productsRes = await page.request.get('/v2/inventory/products?type=BULK');
  if (!productsRes.ok()) return null;
  const products = await jsonArray(productsRes);

  for (const product of products.slice(0, 20)) {
    const sku = product?.sku;
    if (!sku) continue;

    const searchRes = await page.request.get(
      `/v2/inventory/stock/available-search?q=${encodeURIComponent(sku)}&warehouse_id=${warehouseId}`
    );
    if (!searchRes.ok()) continue;

    const items = await jsonArray(searchRes);
    const bulk = items.find((it) => it.kind === 'bulk' && it.product_id === product.id);
    if (bulk) return bulk;
  }

  return null;
}

test.describe('Logística - Consumibles BULK por cantidad', () => {
  test('Wizard de entrega renderiza la pantalla de nueva entrega', async ({ page }) => {
    await login(page);
    await page.goto('/app/logistics/deliveries/new');

    await expect(page.getByRole('heading', { name: 'Nueva Entrega de Materiales' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Seleccionar Cuadrilla' })).toBeVisible();
  });

  test('API: seleccionar BULK persiste cantidad y valida stock insuficiente', async ({ page }) => {
    await login(page);

    const context = await findDeliveryContext(page);
    test.skip(!context, 'No hay depósito central/móvil o cuadrilla activa para probar la entrega');
    const { central, team, mobile } = context!;

    const bulk = await findBulkProduct(page, central.id);
    test.skip(!bulk, 'No hay producto BULK con stock en el depósito origen');

    const createRes = await page.request.post('/v2/logistics/deliveries', {
      data: {
        team_id: team.id,
        warehouse_from_id: central.id,
        warehouse_to_id: mobile.id,
        notes: 'E2E bulk quantity test',
      },
    });
    expect(createRes.status()).toBe(201);
    const delivery = await createRes.json();

    try {
      // Seleccionar el consumible con cantidad 2
      const scanRes = await page.request.post(`/v2/logistics/deliveries/${delivery.id}/scan-barcode`, {
        data: { product_code: bulk.product_sku, quantity: 2 },
      });
      expect(scanRes.ok()).toBeTruthy();
      const scan = await scanRes.json();
      expect(scan.is_serialized).toBe(false);
      expect(scan.delivery_item_id).toBeTruthy();
      expect(Number(scan.quantity)).toBe(2);

      // Actualizar a una cantidad mayor que el stock disponible → 400
      const tooMuch = Number(bulk.available_quantity) + 100;
      const patchTooMuch = await page.request.patch(
        `/v2/logistics/deliveries/${delivery.id}/items/${scan.delivery_item_id}`,
        { data: { quantity_delivered: tooMuch } }
      );
      expect(patchTooMuch.status()).toBe(400);

      // Actualizar a 1 → éxito
      const patchOk = await page.request.patch(
        `/v2/logistics/deliveries/${delivery.id}/items/${scan.delivery_item_id}`,
        { data: { quantity_delivered: 1 } }
      );
      expect(patchOk.ok()).toBeTruthy();
    } finally {
      await page.request.post(`/v2/logistics/deliveries/${delivery.id}/cancel`);
    }
  });
});
