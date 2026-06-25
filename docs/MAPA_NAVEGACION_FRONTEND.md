# Mapa de Navegacion Frontend - Emerald ERP

Version: 2026-06-24
Fuente: configuracion real de menu y rutas en frontend.

---

## 1) Objetivo

Este documento centraliza:
- Donde aparece cada modulo en el menu lateral.
- Que ruta abre cada entrada.
- Que pantalla/componente renderiza.
- Que permiso RBAC controla la visibilidad/acceso.

Referencias tecnicas:
- frontend/src/components/AppSidebar.jsx
- frontend/src/App.jsx

---

## 2) Menu lateral -> modulo -> ventana

## Principal

| Menu | Ruta | Pantalla | Permiso/Guard |
|---|---|---|---|
| Dashboard | /app | DashboardPage | resource=dashboard |

## Operaciones

| Menu | Ruta | Pantalla | Permiso/Guard |
|---|---|---|---|
| Tickets | /app/tickets | TicketsPage | resource=tickets |
| Cuadrillas | /app/cuadrillas | CuadrillasPage | resource=cuadrillas |
| Coordinacion | /app/coordination | CoordinationPage | resource=coordination |
| Ordenes de Trabajo | /app/work-orders | WorkOrdersPage | resource=work_orders |

## Ingenieria / NOC

| Menu | Ruta | Pantalla | Permiso/Guard |
|---|---|---|---|
| Tablero Kanban | /app/engineering | EngineeringBoardPage | resource=engineering |

## Logistica

| Menu | Ruta | Pantalla | Permiso/Guard |
|---|---|---|---|
| Dashboard | /app/inventory | InventoryDashboard | resource=inventory, action=view_all |
| Almacenes | /app/inventory/warehouses | WarehouseList | resource=inventory_warehouses |
| Flota | /app/fleet | FleetPage | resource=fleet_assigned |
| Catalogo | /app/inventory/products | ProductCatalog | resource=inventory, action=view_all |
| Operaciones | /app/inventory/transfer | StockTransferWizard | resource=inventory, action=transfer |
| Auditoria | /app/inventory/movements | MovementsHistory | resource=inventory, action=view_all |
| Alertas | /app/inventory/alerts | StockAlerts | resource=inventory, action=view_all |
| Entregas a Cuadrillas | /app/logistics/deliveries | MaterialDeliveryDashboard | resource=inventory_admin |

## Red y Clientes

| Menu | Ruta | Pantalla | Permiso/Guard |
|---|---|---|---|
| Conexiones | /app/connections | ConnectionsPage | resource=connections |
| Nodos | /app/nodes | NodesPage | resource=nodes |
| Clientes | /app/clients | CustomersPage | resource=clients |

## Sistema

| Menu | Ruta | Pantalla | Permiso/Guard |
|---|---|---|---|
| Configuracion | /app/settings | SettingsPage | resource=self_service |
| Auditoria | /app/audit | AuditLogsPage | resource=audit_logs |

---

## 3) Rutas operativas sin entrada directa en menu

Estas ventanas existen y son parte del flujo, aunque no siempre tienen item propio en sidebar:

| Ruta | Pantalla | Uso |
|---|---|---|
| /app/tickets/:id | TicketDetailPage | Detalle de ticket desde listado |
| /app/work-orders/:id/execute | WorkOrderExecutionPage | Ejecucion tecnica de OT |
| /app/inventory/warehouses/:id | WarehouseDetail | Detalle de deposito |
| /app/inventory/adjustments | StockAdjustments | Ajustes manuales de stock |
| /app/logistics/deliveries/new | MaterialDeliveryWizard | Nueva entrega a cuadrilla |
| /app/logistics/deliveries/:id | MaterialDeliveryWizard | Edicion/seguimiento de entrega |
| /app/logistics/receipts/new | MaterialReceiptWizard | Nueva recepcion |
| /app/logistics/receipts/:id | MaterialReceiptWizard | Edicion/seguimiento de recepcion |
| /app/logistics/print-labels | BarcodeLabelPrinter | Impresion/reimpresion de etiquetas |

---

## 4) Notas de lectura rapida

1. Visibilidad en menu y acceso a rutas no son iguales:
- El menu filtra por permisos de cada item.
- Las rutas tambien validan permisos con RoleGuard.

2. Si un usuario no tiene permiso:
- Puede no ver el item en sidebar.
- Si intenta entrar por URL, RoleGuard redirige a fallbackPath.

3. Fuente de verdad para cambios futuros:
- Cualquier cambio de navegacion debe reflejarse en AppSidebar.jsx y App.jsx.

---

## 5) Mantenimiento

Actualizar este archivo cuando cambie alguno de estos puntos:
- Seccion/menu en sidebar.
- Ruta /app/* de un modulo.
- Pantalla renderizada por una ruta.
- Permiso RBAC de visibilidad o acceso.
