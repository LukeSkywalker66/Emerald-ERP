/**
 * Prueba unitaria de la matriz RBAC (Fase 1).
 *
 * Bloquea el comportamiento canónico de PERMISSIONS_MATRIX, normalizeRole
 * y hasPermission para detectar regresiones de acceso por rol sin necesidad
 * de base de datos ni navegador.
 *
 * Ejecución:
 *   node --test src/utils/permissions.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  getAccessibleResources,
  normalizeRole,
} from './permissions.js';

test('normalizeRole mapea nombres en español/inglés al rol canónico', () => {
  assert.equal(normalizeRole('admin'), 'admin');
  assert.equal(normalizeRole('operator'), 'operator');
  assert.equal(normalizeRole('operador'), 'operator');
  assert.equal(normalizeRole('tecnico'), 'tecnico');
  assert.equal(normalizeRole('technician'), 'tecnico');
  assert.equal(normalizeRole('coordinador'), 'coordinator');
  assert.equal(normalizeRole('super_user'), 'admin');
  assert.equal(normalizeRole('superadmin'), 'admin');
  assert.equal(normalizeRole(null), null);
  assert.equal(normalizeRole(undefined), null);
});

test('admin tiene acceso a todos los recursos', () => {
  const resources = getAccessibleResources('admin');
  const expected = [
    'dashboard', 'tickets', 'coordination', 'work_orders', 'engineering',
    'cuadrillas', 'inventory', 'inventory_warehouses', 'inventory_admin',
    'fleet_assigned', 'users', 'settings', 'audit_logs', 'connections',
    'nodes', 'clients', 'self_service',
  ];
  for (const r of expected) {
    assert.ok(resources.includes(r), `admin debe acceder a ${r}`);
  }
});

test('operador (vía alias "operador") ve módulos operativos y no los de solo-admin', () => {
  const resources = getAccessibleResources('operador');
  const visible = [
    'dashboard', 'tickets', 'coordination', 'work_orders', 'engineering',
    'cuadrillas', 'inventory', 'inventory_warehouses', 'inventory_admin',
    'fleet_assigned', 'connections', 'nodes', 'clients', 'self_service',
  ];
  for (const r of visible) {
    assert.ok(resources.includes(r), `operador debe ver ${r}`);
  }
  assert.ok(!resources.includes('audit_logs'), 'operador NO debe ver auditoría');
  assert.ok(!resources.includes('users'), 'operador NO debe ver usuarios');
  assert.ok(!resources.includes('settings'), 'operador NO debe ver settings (solo self_service)');
});

test('tecnico ve solo su ruta y no módulos de gestión', () => {
  const resources = getAccessibleResources('tecnico');
  const visible = [
    'tickets', 'work_orders', 'inventory', 'inventory_warehouses',
    'fleet_assigned', 'self_service',
  ];
  for (const r of visible) {
    assert.ok(resources.includes(r), `tecnico debe ver ${r}`);
  }
  for (const hidden of ['dashboard', 'coordination', 'engineering', 'cuadrillas', 'inventory_admin', 'audit_logs', 'connections', 'nodes', 'clients', 'settings', 'users']) {
    assert.ok(!resources.includes(hidden), `tecnico NO debe ver ${hidden}`);
  }
});

test('hasPermission respeta deniedActionsByRole', () => {
  assert.equal(hasPermission('tecnico', 'tickets', 'view'), true);
  assert.equal(hasPermission('tecnico', 'tickets', 'create'), false);
  assert.equal(hasPermission('tecnico', 'work_orders', 'view'), true);
  assert.equal(hasPermission('tecnico', 'work_orders', 'view_all'), false);
  assert.equal(hasPermission('admin', 'audit_logs', 'view'), true);
  assert.equal(hasPermission('operator', 'audit_logs', 'view'), false);
  assert.equal(hasPermission('operador', 'dashboard', 'view'), true);
});

test('hasPermission falla cerrado ante recurso o acción desconocidos', () => {
  assert.equal(hasPermission('admin', 'recurso_inexistente', 'view'), false);
  assert.equal(hasPermission('admin', 'dashboard', 'accion_inexistente'), false);
  assert.equal(hasPermission(null, 'dashboard', 'view'), false);
});
