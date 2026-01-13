# Plan de Implementación - Frontend Módulo de Inventario

## Resumen Ejecutivo

Frontend para módulo de inventario operativo con enfoque en flujos críticos del ISP:
- Gestión de almacenes móviles (camionetas técnicos)
- Transferencias de stock BULK y SERIALIZED
- Auditoría completa de movimientos
- Dashboards de stock y alertas

**Stack**: React + Vite, TailwindCSS, React Router, Axios

---

## Endpoints Disponibles (Backend)

### ✅ Warehouses
- `GET /api/inventory/warehouses` - Lista con filtros
- `POST /api/inventory/warehouses` - Crear nuevo
- `GET /api/inventory/warehouses/{id}/stock` - Stock completo (BULK+SERIALIZED)

### ✅ Products
- `GET /api/inventory/products` - Lista con filtros
- `POST /api/inventory/products` - Crear producto

### ✅ Serial Items
- `POST /api/inventory/serial-items` - Registrar serial nuevo

### ✅ Stock Operations
- `POST /api/inventory/transfer` - Transferir entre warehouses
- `POST /api/inventory/adjustments` - Ajustes de stock (compras, correcciones)

### ✅ Auditoría
- `GET /api/inventory/movements` - Historial de movimientos

---

## Arquitectura de Componentes

### Estructura de Carpetas Propuesta

```
frontend/src/
├── pages/
│   └── inventory/
│       ├── InventoryDashboard.jsx          # P1 - Dashboard principal
│       ├── WarehouseList.jsx               # P1 - Lista de warehouses
│       ├── WarehouseDetail.jsx             # P2 - Detalle de warehouse
│       ├── ProductCatalog.jsx              # P2 - Catálogo de productos
│       ├── StockTransferWizard.jsx         # P3 - Wizard de transferencias
│       ├── StockAdjustments.jsx            # P3 - Ajustes y compras
│       ├── MovementsHistory.jsx            # P2 - Auditoría de movimientos
│       └── StockAlerts.jsx                 # P4 - Alertas de stock bajo
│
├── components/
│   └── inventory/
│       ├── WarehouseCard.jsx               # Card resumen de warehouse
│       ├── WarehouseForm.jsx               # Formulario crear/editar warehouse
│       ├── ProductCard.jsx                 # Card de producto
│       ├── ProductForm.jsx                 # Formulario crear producto
│       ├── StockTable.jsx                  # Tabla unificada BULK+SERIALIZED
│       ├── SerialItemsList.jsx             # Lista de seriales con filtros
│       ├── TransferFormBulk.jsx            # Formulario transfer BULK
│       ├── TransferFormSerialized.jsx      # Formulario transfer SERIALIZED
│       ├── AdjustmentForm.jsx              # Formulario ajustes de stock
│       ├── MovementTimeline.jsx            # Timeline de movimientos
│       ├── StockLevelBadge.jsx             # Badge con nivel de stock (verde/amarillo/rojo)
│       ├── WarehouseTypeIcon.jsx           # Ícono según tipo (CENTRAL/MOBILE/VIRTUAL)
│       └── ProductTypeBadge.jsx            # Badge BULK vs SERIALIZED
│
└── services/
    └── inventoryService.js                 # Axios client para API de inventario
```

---

## Vistas (Pages) - Orden de Implementación

### 🟢 PRIORIDAD 1 - Fundamentos (Sprint 1)

#### 1.1. InventoryDashboard (Complejidad: 🟢 Baja)
**Ruta**: `/inventory`

**Objetivo**: Vista de entrada al módulo con métricas clave.

**Componentes:**
- Tarjetas con KPIs:
  - Total warehouses (CENTRAL/MOBILE/VIRTUAL)
  - Total productos en catálogo
  - Productos con stock bajo
  - Movimientos última semana
- Gráfico de barras: Stock por warehouse (top 5)
- Lista de últimas 10 movimientos (mini-timeline)
- Botones de acceso rápido a otras vistas

**API Calls:**
- `GET /api/inventory/warehouses` (para contar)
- `GET /api/inventory/products` (para contar y detectar stock bajo)
- `GET /api/inventory/movements?limit=10` (últimas operaciones)

**Complejidad Baja**: Solo lectura, sin formularios, componentes simples de cards.

---

#### 1.2. WarehouseList (Complejidad: 🟢 Baja-Media)
**Ruta**: `/inventory/warehouses`

**Objetivo**: Listar y gestionar warehouses.

**Funcionalidades:**
- Tabla/Grid con todos los warehouses
- Filtros por tipo (CENTRAL/MOBILE/VIRTUAL)
- Buscar por nombre
- Botón "Crear Warehouse" → abre modal con WarehouseForm
- Click en warehouse → navega a WarehouseDetail
- Badge visual según tipo (ícono camión para MOBILE, edificio para CENTRAL)

**Componentes Reutilizables:**
- `WarehouseCard` (card con resumen)
- `WarehouseForm` (modal para crear/editar)
- `WarehouseTypeIcon` (ícono visual)

**API Calls:**
- `GET /api/inventory/warehouses?warehouse_type={filter}`
- `POST /api/inventory/warehouses` (crear nuevo)

**Validaciones en Form:**
- Tipo MOBILE requiere seleccionar técnico (user_id)
- Tipos CENTRAL/VIRTUAL no permiten user_id
- Nombre obligatorio

**Complejidad Baja-Media**: Formulario simple + validaciones básicas.

---

### 🟡 PRIORIDAD 2 - Visualización (Sprint 2)

#### 2.1. WarehouseDetail (Complejidad: 🟡 Media)
**Ruta**: `/inventory/warehouses/:id`

**Objetivo**: Vista completa de stock en un warehouse específico.

**Secciones:**
1. **Header**: Nombre warehouse, tipo, técnico asignado (si es MOBILE)
2. **Tabs**:
   - **Stock Actual**: Tabla unificada con productos BULK y SERIALIZED
   - **Movimientos**: Timeline de entradas/salidas del warehouse
   - **Seriales**: Lista detallada de serial_items en este warehouse

**Componentes:**
- `StockTable` - Tabla con dos columnas:
  - BULK: Producto | Cantidad | Unidad | Nivel
  - SERIALIZED: Producto | Cantidad de Seriales | Ver Detalle (expande lista)
- `SerialItemsList` - Grid de seriales con status, serial_number, notas
- `MovementTimeline` - Timeline visual (entrada verde ↑, salida roja ↓)

**API Calls:**
- `GET /api/inventory/warehouses/{id}/stock` (stock completo)
- `GET /api/inventory/movements?warehouse_id={id}&limit=50` (movimientos)

**Características Avanzadas:**
- Exportar stock a Excel (futuro)
- Botón "Transferir Stock" → abre StockTransferWizard con origen pre-seleccionado
- Indicador visual de stock bajo (badge rojo si < min_stock_alert)

**Complejidad Media**: Múltiples tabs, tabla compleja BULK+SERIALIZED, integración con wizard.

---

#### 2.2. ProductCatalog (Complejidad: 🟡 Media)
**Ruta**: `/inventory/products`

**Objetivo**: Gestionar catálogo de productos.

**Funcionalidades:**
- Grid de productos con filtros:
  - Tipo (BULK/SERIALIZED)
  - Categoría (Cableado, ONUs, Conectores, etc.)
  - Buscar por nombre o SKU
- Botón "Crear Producto" → modal ProductForm
- Click en producto → expande card con:
  - Descripción completa
  - Stock total en todos los warehouses
  - Nivel de alerta (min_stock_alert)
  - Último movimiento

**Componentes:**
- `ProductCard` - Card expandible
- `ProductForm` - Formulario con validaciones:
  - SKU único (validar en backend)
  - Tipo BULK vs SERIALIZED (cambia UI)
  - min_stock_alert numérico
  - Categoría (select con opciones comunes + custom)

**API Calls:**
- `GET /api/inventory/products?product_type={filter}&category={cat}&search={q}`
- `POST /api/inventory/products` (crear)

**Complejidad Media**: Formulario con validaciones + filtros múltiples + UI condicional (BULK vs SERIALIZED).

---

#### 2.3. MovementsHistory (Complejidad: 🟡 Media)
**Ruta**: `/inventory/movements`

**Objetivo**: Auditoría completa de operaciones.

**Funcionalidades:**
- Timeline interactiva con todos los movimientos
- Filtros avanzados:
  - Rango de fechas (date picker)
  - Tipo de movimiento (PURCHASE/TRANSFER/CONSUMPTION/ADJUSTMENT)
  - Producto específico
  - Warehouse específico (origen O destino)
  - Usuario que ejecutó
- Paginación (50 registros por página)
- Exportar a CSV (futuro)

**Componentes:**
- `MovementTimeline` - Timeline con íconos según tipo:
  - 📦 PURCHASE (verde)
  - 🔄 TRANSFER (azul)
  - 📤 CONSUMPTION (rojo)
  - ⚙️ ADJUSTMENT (amarillo)
- Card por movimiento con:
  - Fecha/hora
  - Producto (SKU + nombre)
  - Origen → Destino (warehouses)
  - Cantidad o serial_number
  - Usuario
  - Referencia y notas

**API Calls:**
- `GET /api/inventory/movements?product_id={}&warehouse_id={}&movement_type={}&limit=50&offset={}`

**Complejidad Media**: Filtros múltiples + paginación + timeline visual compleja.

---

### 🔴 PRIORIDAD 3 - Operaciones Críticas (Sprint 3)

#### 3.1. StockTransferWizard (Complejidad: 🔴 Alta)
**Ruta**: `/inventory/transfer`

**Objetivo**: Wizard multi-paso para transferencias de stock.

**Flujo del Wizard (5 pasos):**

**Paso 1: Seleccionar Producto**
- Select de productos con búsqueda
- Muestra tipo (BULK/SERIALIZED) y stock disponible
- Al seleccionar → determina si muestra FormBulk o FormSerialized

**Paso 2a: Transfer BULK (si producto es BULK)**
- Select warehouse origen
- Muestra stock disponible en origen (con validación en tiempo real)
- Select warehouse destino
- Input cantidad (con validación: <= stock disponible)
- Botón "Siguiente" deshabilitado si cantidad inválida

**Paso 2b: Transfer SERIALIZED (si producto es SERIALIZED)**
- Select warehouse origen
- Muestra lista de seriales disponibles en origen (checkbox multi-select)
- Select warehouse destino
- Botones "Seleccionar Todos" / "Deseleccionar Todos"

**Paso 3: Información Adicional**
- Input "Referencia" (max 200 chars, opcional)
- Textarea "Notas" (opcional)
- Ejemplos sugeridos: "Carga camioneta técnico Juan", "Preparación obra #2025-010"

**Paso 4: Confirmación**
- Resumen visual:
  - Producto: {nombre} ({SKU})
  - Origen: {warehouse_name}
  - Destino: {warehouse_name}
  - Cantidad: {quantity} {unit} ó {serial_count} seriales
  - Referencia: {reference}
- Botones "Volver" y "Confirmar Transferencia"

**Paso 5: Resultado**
- ✅ Transferencia exitosa (verde)
- Muestra IDs de movimientos creados
- Botones: "Ver Movimientos" / "Nueva Transferencia" / "Volver a Dashboard"

**Componentes:**
- `TransferFormBulk` - Form específico para BULK
- `TransferFormSerialized` - Form específico para SERIALIZED con checkbox list
- `TransferSummary` - Card de confirmación

**API Calls:**
- `GET /api/inventory/products` (paso 1)
- `GET /api/inventory/warehouses/{id}/stock` (validar disponibilidad en tiempo real)
- `POST /api/inventory/transfer` (paso 4 - submit)

**Validaciones Críticas:**
- BULK: cantidad > 0 y <= stock disponible
- SERIALIZED: al menos 1 serial seleccionado, todos deben pertenecer a warehouse origen
- Origen != Destino
- Manejo de errores 400 (stock insuficiente) con mensaje claro

**Complejidad Alta**: Multi-paso, validaciones en tiempo real, UI condicional (BULK vs SERIALIZED), manejo de errores.

---

#### 3.2. StockAdjustments (Complejidad: 🟡 Media-Alta)
**Ruta**: `/inventory/adjustments`

**Objetivo**: Registrar compras y correcciones de stock.

**Funcionalidades:**
- Formulario de ajuste:
  - Select producto (solo BULK, filtrar SERIALIZED)
  - Select warehouse destino
  - Input cantidad (numérico, > 0)
  - Radio buttons: PURCHASE / ADJUSTMENT
  - Input referencia (ej: "Orden Compra #PO-2025-123")
  - Textarea notas
- Tabla histórica de ajustes recientes (últimos 20)
- Badge visual según tipo:
  - 🛒 PURCHASE (verde)
  - ⚙️ ADJUSTMENT (amarillo)

**Componentes:**
- `AdjustmentForm` - Formulario principal
- Mini-tabla de histórico con filtro por warehouse

**API Calls:**
- `GET /api/inventory/products?product_type=BULK` (solo productos a granel)
- `GET /api/inventory/warehouses` (select destino)
- `POST /api/inventory/adjustments` (submit)
- `GET /api/inventory/movements?movement_type=PURCHASE&movement_type=ADJUSTMENT&limit=20`

**Validaciones:**
- Solo productos BULK permitidos
- Cantidad > 0 (backend valida, pero UI debe prevenir)
- Referencia max 200 chars

**Complejidad Media-Alta**: Formulario complejo + validaciones + tabla histórica filtrada.

---

### 🟣 PRIORIDAD 4 - Features Avanzados (Sprint 4)

#### 4.1. StockAlerts (Complejidad: 🟡 Media)
**Ruta**: `/inventory/alerts`

**Objetivo**: Dashboard de productos con stock bajo.

**Funcionalidades:**
- Tabla de productos bajo mínimo:
  - Producto (nombre, SKU)
  - Tipo (BULK/SERIALIZED)
  - Stock Actual
  - Mínimo Configurado (min_stock_alert)
  - Diferencia (badge rojo con -X unidades)
  - Botones de acción rápida:
    - BULK: "Registrar Compra" → modal AdjustmentForm pre-llenado
    - SERIALIZED: "Registrar Serials" → modal SerialItemForm
- Filtro por categoría
- Ordenar por diferencia (más críticos primero)

**Lógica de Cálculo (Backend Future Endpoint):**
- Endpoint sugerido: `GET /api/inventory/stock-alerts`
- Alternativamente, calcular en frontend:
  - BULK: Sumar stock_bulk de todos los warehouses, comparar con min_stock_alert
  - SERIALIZED: Contar serial_items con status NEW/USED, comparar con min_stock_alert

**API Calls:**
- `GET /api/inventory/products` (todos)
- `GET /api/inventory/warehouses/{id}/stock` (por cada warehouse - optimizar con endpoint agregado)

**Complejidad Media**: Cálculos de agregación + tabla interactiva + modales pre-llenados.

---

## Componentes Reutilizables

### UI Components (Atomic)

#### `WarehouseCard`
Props: `{ warehouse, onClick }`
- Card con nombre, tipo, ícono
- Badge con user_name (si es MOBILE)
- Resumen de stock (cantidad de productos distintos)

#### `WarehouseForm`
Props: `{ onSubmit, onCancel, initialData? }`
- Select tipo (CENTRAL/MOBILE/VIRTUAL)
- Input nombre
- Select usuario (solo si tipo=MOBILE, condicional)
- Validaciones en tiempo real

#### `ProductCard`
Props: `{ product, expandable?, onExpand? }`
- SKU + nombre
- Badge tipo (BULK/SERIALIZED)
- Categoría
- Expandible: muestra descripción + stock total + min_alert

#### `ProductForm`
Props: `{ onSubmit, onCancel }`
- Input nombre, SKU (validación unique)
- Select tipo (BULK/SERIALIZED)
- Input categoría (select + custom)
- Textarea descripción
- Input min_stock_alert (numérico)

#### `StockTable`
Props: `{ warehouseStock }`
- Tabla unificada BULK + SERIALIZED
- Columnas:
  - Producto (SKU + nombre)
  - Tipo (badge)
  - Cantidad (con unidad: m, unidades, etc.)
  - Nivel (badge verde/amarillo/rojo)
  - Acciones (Ver Seriales si SERIALIZED)
- Ordenar por nombre, tipo, cantidad

#### `SerialItemsList`
Props: `{ serialItems, showWarehouse?, showActions? }`
- Grid/Table de seriales
- Columnas: Serial Number, Status, Warehouse (opcional), Notas
- Click en serial → modal con historial completo del serial

#### `MovementTimeline`
Props: `{ movements }`
- Timeline vertical con íconos según tipo
- Card por movimiento con toda la info
- Colores según tipo: PURCHASE verde, TRANSFER azul, CONSUMPTION rojo, ADJUSTMENT amarillo

#### `StockLevelBadge`
Props: `{ current, min_alert }`
- Badge verde: > min_alert * 1.5
- Badge amarillo: entre min_alert y min_alert * 1.5
- Badge rojo: < min_alert

#### `WarehouseTypeIcon`
Props: `{ type }`
- 🏢 CENTRAL
- 🚚 MOBILE
- 📦 VIRTUAL

#### `ProductTypeBadge`
Props: `{ type }`
- Badge azul "A GRANEL" (BULK)
- Badge púrpura "SERIALIZADO" (SERIALIZED)

---

## Service Layer (inventoryService.js)

```javascript
import axios from 'axios';

const BASE_URL = '/api/inventory';

// Warehouses
export const getWarehouses = (filters) => axios.get(`${BASE_URL}/warehouses`, { params: filters });
export const createWarehouse = (data) => axios.post(`${BASE_URL}/warehouses`, data);
export const getWarehouseStock = (warehouseId) => axios.get(`${BASE_URL}/warehouses/${warehouseId}/stock`);

// Products
export const getProducts = (filters) => axios.get(`${BASE_URL}/products`, { params: filters });
export const createProduct = (data) => axios.post(`${BASE_URL}/products`, data);

// Serial Items
export const createSerialItem = (data) => axios.post(`${BASE_URL}/serial-items`, data);

// Operations
export const transferStock = (data) => axios.post(`${BASE_URL}/transfer`, data);
export const adjustStock = (data) => axios.post(`${BASE_URL}/adjustments`, data);

// Movements
export const getMovements = (filters) => axios.get(`${BASE_URL}/movements`, { params: filters });

// Helpers
export const getStockAlerts = async () => {
  // Lógica para calcular productos bajo mínimo
  // Combina llamadas a products y warehouses/{id}/stock
};
```

---

## Rutas (React Router)

```javascript
// En App.jsx o router config
<Routes>
  <Route path="/inventory" element={<InventoryDashboard />} />
  <Route path="/inventory/warehouses" element={<WarehouseList />} />
  <Route path="/inventory/warehouses/:id" element={<WarehouseDetail />} />
  <Route path="/inventory/products" element={<ProductCatalog />} />
  <Route path="/inventory/transfer" element={<StockTransferWizard />} />
  <Route path="/inventory/adjustments" element={<StockAdjustments />} />
  <Route path="/inventory/movements" element={<MovementsHistory />} />
  <Route path="/inventory/alerts" element={<StockAlerts />} />
</Routes>
```

---

## Plan de Sprints

### Sprint 1 (5-7 días) - Fundamentos
**Objetivo**: Visualización básica y lectura de datos

**Entregables:**
- ✅ `inventoryService.js` con todos los métodos
- ✅ `InventoryDashboard` con KPIs y navegación
- ✅ `WarehouseList` con tabla, filtros y modal crear
- ✅ `WarehouseCard`, `WarehouseForm`, `WarehouseTypeIcon`
- ✅ Rutas configuradas en React Router

**Criterio de Éxito:**
- Usuario puede ver dashboard con métricas
- Usuario puede listar warehouses con filtros
- Usuario puede crear warehouse CENTRAL y MOBILE (validando user_id)

---

### Sprint 2 (5-7 días) - Visualización Avanzada
**Objetivo**: Vistas de detalle y catálogo

**Entregables:**
- ✅ `WarehouseDetail` con tabs (Stock, Movimientos, Seriales)
- ✅ `ProductCatalog` con grid, filtros y modal crear
- ✅ `MovementsHistory` con timeline y filtros
- ✅ `StockTable`, `SerialItemsList`, `MovementTimeline`, `ProductCard`, `ProductForm`
- ✅ `StockLevelBadge`, `ProductTypeBadge`

**Criterio de Éxito:**
- Usuario puede ver stock completo de un warehouse (BULK+SERIALIZED)
- Usuario puede navegar timeline de movimientos con filtros
- Usuario puede gestionar catálogo de productos

---

### Sprint 3 (7-10 días) - Operaciones Críticas
**Objetivo**: Transferencias y ajustes funcionales

**Entregables:**
- ✅ `StockTransferWizard` completo (5 pasos)
- ✅ `TransferFormBulk`, `TransferFormSerialized`
- ✅ `StockAdjustments` con form y tabla histórica
- ✅ `AdjustmentForm`
- ✅ Validaciones en tiempo real (stock disponible)
- ✅ Manejo de errores UX (mensajes claros)

**Criterio de Éxito:**
- Usuario puede transferir cable (BULK) entre warehouses
- Usuario puede transferir ONUs (SERIALIZED) seleccionando seriales
- Usuario puede registrar compras con endpoint de ajustes
- Validaciones previenen transferencias inválidas (stock insuficiente, etc.)

---

### Sprint 4 (3-5 días) - Features Avanzados
**Objetivo**: Alertas y optimizaciones

**Entregables:**
- ✅ `StockAlerts` con tabla de productos bajo mínimo
- ✅ Acciones rápidas desde alerts (modal AdjustmentForm pre-llenado)
- ✅ Optimizaciones de performance (memoización, lazy loading)
- ✅ Exportar a Excel (opcional)

**Criterio de Éxito:**
- Usuario puede ver dashboard de alertas de stock bajo
- Acciones rápidas desde alerts funcionan correctamente
- Performance adecuado con 100+ productos y 50+ warehouses

---

## Diseño UI/UX (Identidad Emerald)

### Paleta de Colores

**Fondos:**
- Zinc-900 (#18181b) - Fondo principal "sala de máquinas"
- Zinc-800 (#27272a) - Cards y modales

**Acentos:**
- Emerald-500 (#10b981) - Primario (botones principales, success)
- Ruby-500 (#ef4444) - Errores, alertas críticas, stock bajo
- Gold-400 (#fbbf24) - Warnings, ADJUSTMENT badge

**Tipo de Movimiento:**
- Verde (#10b981): PURCHASE
- Azul (#3b82f6): TRANSFER
- Rojo (#ef4444): CONSUMPTION
- Amarillo (#fbbf24): ADJUSTMENT

### Iconografía

**Usar Heroicons:**
- 🏢 BuildingOfficeIcon - CENTRAL warehouse
- 🚚 TruckIcon - MOBILE warehouse
- 📦 ArchiveBoxIcon - VIRTUAL warehouse
- 🔄 ArrowsRightLeftIcon - TRANSFER
- 📤 ArrowUpTrayIcon - PURCHASE
- 📥 ArrowDownTrayIcon - CONSUMPTION
- ⚙️ Cog6ToothIcon - ADJUSTMENT
- 🎫 TicketIcon - Serial items
- 📊 ChartBarIcon - Stock levels

### Tipografía

- **Títulos**: Inter Bold, color Emerald-400
- **Subtítulos**: Inter SemiBold, color Zinc-300
- **Body**: Inter Regular, color Zinc-400
- **Monospace** (SKUs, serials): JetBrains Mono, color Zinc-500

### Componentes TailwindCSS

**Card Base:**
```jsx
<div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 shadow-lg">
  {/* content */}
</div>
```

**Botón Primario:**
```jsx
<button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-semibold transition-colors">
  Acción
</button>
```

**Badge:**
```jsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900 text-emerald-300">
  BULK
</span>
```

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

**Componentes Críticos:**
- `WarehouseForm` - Validaciones de tipo MOBILE con user_id
- `TransferFormBulk` - Validación de stock disponible
- `TransferFormSerialized` - Selección de seriales
- `StockLevelBadge` - Cálculo de nivel según min_alert

**Service Layer:**
- `inventoryService.js` - Mocks de axios, respuestas correctas

### Integration Tests

**Flujos Completos:**
- Crear warehouse MOBILE → asignar técnico → verificar en lista
- Seleccionar producto BULK → transferir 50m → verificar stock en destino
- Seleccionar producto SERIALIZED → transferir 3 serials → verificar warehouse_id actualizado

### E2E Tests (Cypress)

**Casos de Negocio:**
- Flujo completo: Dashboard → Crear Warehouse → Crear Producto → Ajustar Stock → Transferir → Ver Movimientos
- Validación de errores: Intentar transferir más stock del disponible → ver mensaje de error

---

## Notas Técnicas

### Performance

**Optimizaciones:**
- Usar `React.memo()` en `WarehouseCard`, `ProductCard`, `MovementTimeline`
- Lazy loading de `StockTransferWizard` (ruta heavy)
- Paginación en `MovementsHistory` (50 registros por página)
- Debounce en inputs de búsqueda (300ms)

### Seguridad

**Validaciones Frontend (No reemplaza backend):**
- Validar stock disponible en tiempo real antes de submit transfer
- Validar SKU único antes de submit (query a GET /products?search={sku})
- Prevenir múltiples clicks en botones (loading state)

### Accesibilidad

- Todos los formularios con labels explícitos
- Modales con `role="dialog"` y focus trap
- Badges con `aria-label` descriptivo
- Tablas con headers semánticos (`<thead>`, `<tbody>`)

---

## Entregables Finales

### Documentación
- README.md del módulo frontend
- Storybook con todos los componentes reutilizables (opcional)
- Guía de usuario final (screenshots + flujos)

### Código
- 8 páginas completas (Dashboard, Warehouses, Detail, Products, Transfer, Adjustments, Movements, Alerts)
- 15+ componentes reutilizables
- Service layer completo con manejo de errores
- Tests unitarios (80%+ coverage en componentes críticos)

---

**Fecha**: 12 de Enero 2026  
**Autor**: GitHub Copilot  
**Versión**: 1.0  
**Estado**: 🟢 Ready para Sprint 1
