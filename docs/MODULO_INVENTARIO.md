# Módulo de Inventario Operativo - Emerald ERP

**Última actualización:** 14 de Enero de 2026 (revisado 02 Jun 2026)  
**Estado:** ✅ **COMPLETO Y FUNCIONAL**

## Descripción General

Módulo completo de gestión de inventario diseñado específicamente para las operaciones de un ISP, con soporte para:

- **Almacenes Móviles**: Camionetas de técnicos con stock asignado
- **Seguimiento de Seriales**: ONUs, routers y equipamiento rastreable individualmente
- **Stock a Granel**: Cables, conectores y materiales medibles
- **Auditoría Completa**: Registro detallado de todos los movimientos
- **CRUD de Productos**: Catálogo completo con create/edit/delete ✅
- **Transferencias de Stock**: Wizard paso a paso BULK y SERIALIZED ✅
- **Integración con Work Orders**: Materiales persistentes en OT ✅

## Arquitectura

### Base de Datos (5 Tablas Principales)

#### 1. `warehouses` - Almacenes
```sql
- id: INTEGER PRIMARY KEY
- name: VARCHAR(100) NOT NULL
- type: warehouse_type_enum NOT NULL
- user_id: INTEGER (FK a users) -- Solo para tipo MOBILE
- created_at, updated_at: TIMESTAMP
```

**Tipos de Warehouse (`warehouse_type_enum`)**:
- `CENTRAL`: Almacén principal
- `MOBILE`: Camioneta de técnico (requiere `user_id`)
- `VIRTUAL`: Ubicaciones lógicas (instalado en cliente, en tránsito)

#### 2. `products` - Catálogo de Productos
```sql
- id: INTEGER PRIMARY KEY
- name: VARCHAR(200) NOT NULL
- sku: VARCHAR(50) UNIQUE NOT NULL
- type: product_type_enum NOT NULL
- category: VARCHAR(100)
- description: TEXT
- min_stock_alert: INTEGER DEFAULT 0
- created_at, updated_at: TIMESTAMP
```

**Tipos de Producto (`product_type_enum`)**:
- `SERIALIZED`: Item único con número de serie (ONU, router)
- `BULK`: Medible en cantidades (cable x metros, conectores x unidad)

#### 3. `stock_bulk` - Stock a Granel
```sql
- id: INTEGER PRIMARY KEY
- warehouse_id: INTEGER (FK a warehouses)
- product_id: INTEGER (FK a products)
- quantity: NUMERIC(10,2) NOT NULL
- created_at, updated_at: TIMESTAMP

CONSTRAINT: UNIQUE(warehouse_id, product_id) -- Un producto solo puede tener 1 registro por warehouse
```

#### 4. `serial_items` - Items con Serial Único
```sql
- id: INTEGER PRIMARY KEY
- serial_number: VARCHAR(100) UNIQUE NOT NULL
- product_id: INTEGER (FK a products)
- warehouse_id: INTEGER (FK a warehouses)
- status: serial_item_status_enum NOT NULL
- ticket_id: INTEGER (FK a tickets) -- Ticket donde fue instalado (si aplica)
- notes: TEXT
- created_at, updated_at: TIMESTAMP
```

**Estados de Serial (`serial_item_status_enum`)**:
- `NEW`: Nuevo sin usar
- `USED`: Usado pero funcional
- `DAMAGED`: Dañado/en RMA
- `INSTALLED`: Instalado en cliente (requiere `ticket_id`)

#### 5. `stock_movements` - Auditoría de Movimientos
```sql
- id: INTEGER PRIMARY KEY
- product_id: INTEGER (FK a products)
- from_warehouse_id: INTEGER (FK a warehouses, nullable)
- to_warehouse_id: INTEGER (FK a warehouses, nullable)
- quantity: NUMERIC(10,2) -- Solo para BULK
- serial_item_id: INTEGER (FK a serial_items) -- Solo para SERIALIZED
- movement_type: movement_type_enum NOT NULL
- reference: VARCHAR(200)
- notes: TEXT
- user_id: INTEGER (FK a users) -- Quién ejecutó el movimiento
- date: TIMESTAMP DEFAULT NOW()
```

**Tipos de Movimiento (`movement_type_enum`)**:
- `PURCHASE`: Compra nueva (from_warehouse=NULL)
- `TRANSFER`: Transferencia entre warehouses
- `CONSUMPTION`: Consumo/uso (to_warehouse=NULL)
- `RECOVERY`: Recuperación de campo
- `ADJUSTMENT`: Ajuste de inventario

## Endpoints API

### Warehouses

#### `GET /api/inventory/warehouses`
Lista todos los warehouses con filtros opcionales.

**Query Params:**
- `warehouse_type` (optional): Filtrar por tipo (CENTRAL/MOBILE/VIRTUAL)
- `user_id` (optional): Filtrar por técnico asignado (solo para MOBILE)

**Response:** `List[WarehouseResponse]`

#### `POST /api/inventory/warehouses`
Crear nuevo warehouse.

**Request Body:** `WarehouseCreate`
```json
{
  "name": "Camioneta Técnico Juan",
  "type": "MOBILE",
  "user_id": 5  // Obligatorio para MOBILE, null para CENTRAL/VIRTUAL
}
```

**Validaciones:**
- Tipo MOBILE requiere `user_id`
- Tipos CENTRAL/VIRTUAL no pueden tener `user_id`
- `user_id` debe existir en tabla users

#### `GET /api/inventory/warehouses/{warehouse_id}/stock`
Obtener stock completo de un warehouse (vista unificada BULK + SERIALIZED).

**Response:** `WarehouseStockResponse`
```json
{
  "warehouse_id": 1,
  "warehouse_name": "Depósito Central",
  "warehouse_type": "CENTRAL",
  "items": [
    {
      "product_id": 10,
      "product_name": "Cable UTP Cat6",
      "product_sku": "CAB-UTP6",
      "product_type": "BULK",
      "category": "Cableado",
      "quantity": 500.0,  // 500 metros
      "serial_items": null,
      "serial_count": null
    },
    {
      "product_id": 20,
      "product_name": "ONU GPON Huawei HG8546M",
      "product_sku": "ONU-HW-8546",
      "product_type": "SERIALIZED",
      "category": "ONUs",
      "quantity": null,
      "serial_count": 15,  // 15 ONUs disponibles
      "serial_items": [
        {
          "id": 101,
          "serial_number": "HWONU123456",
          "status": "NEW",
          "warehouse_id": 1,
          "warehouse_name": "Depósito Central",
          "product_id": 20,
          "product_name": "ONU GPON Huawei HG8546M",
          "product_sku": "ONU-HW-8546",
          "ticket_id": null,
          "notes": null,
          "created_at": "2025-01-12T10:00:00",
          "updated_at": "2025-01-12T10:00:00"
        }
        // ... 14 ONUs más
      ]
    }
  ]
}
```

### Products

#### `GET /api/inventory/products`
Listar productos con filtros.

**Query Params:**
- `product_type` (optional): SERIALIZED/BULK
- `category` (optional): Filtrar por categoría
- `search` (optional): Buscar en nombre o SKU

#### `POST /api/inventory/products`
Crear producto en catálogo.

**Request Body:** `ProductCreate`
```json
{
  "name": "ONU GPON TP-Link TX-6610",
  "sku": "ONU-TPL-6610",
  "type": "SERIALIZED",
  "category": "ONUs",
  "description": "ONU GPON 1GE + WiFi AC1200",
  "min_stock_alert": 5
}
```

**Validaciones:**
- SKU debe ser único en todo el sistema

### Serial Items

#### `POST /api/inventory/serial-items`
Registrar nuevo item con serial.

**Request Body:** `SerialItemCreate`
```json
{
  "serial_number": "TPONU987654",
  "product_id": 25,
  "warehouse_id": 1,
  "status": "NEW",
  "notes": "Compra Lote #2023-045"
}
```

**Validaciones:**
- `product_id` debe ser tipo SERIALIZED
- `serial_number` debe ser único
- Crea automáticamente movimiento de tipo PURCHASE

### Stock Transfers (CRÍTICO)

#### `POST /api/inventory/transfer`
Transferir stock entre warehouses.

**Request Body:** `StockTransferRequest`

**Caso 1: Producto BULK (Cable)**
```json
{
  "product_id": 10,
  "from_warehouse_id": 1,
  "to_warehouse_id": 3,
  "quantity": 50.0,  // 50 metros de cable
  "serial_item_ids": null,
  "reference": "Preparación instalación Barrio Norte",
  "notes": "Cable para obra #2025-010"
}
```

**Caso 2: Producto SERIALIZED (ONUs)**
```json
{
  "product_id": 20,
  "from_warehouse_id": 1,
  "to_warehouse_id": 3,
  "quantity": null,
  "serial_item_ids": [101, 102, 103],  // 3 ONUs específicas
  "reference": "Carga camioneta técnico Juan",
  "notes": "Instalaciones programadas día Lunes"
}
```

**Response:** `StockTransferResponse`
```json
{
  "success": true,
  "movements_created": [55, 56, 57],  // IDs de movimientos creados
  "message": "Transferencia exitosa: 3 movimiento(s) registrado(s)"
}
```

**Validaciones Críticas:**
1. Producto BULK requiere `quantity` > 0 (no debe enviar `serial_item_ids`)
2. Producto SERIALIZED requiere `serial_item_ids` no vacío (no debe enviar `quantity`)
3. Stock suficiente en warehouse origen:
   - BULK: Valida que `quantity` disponible >= `quantity` solicitada
   - SERIALIZED: Valida que todos los `serial_item_ids` existan, pertenezcan al producto correcto, y estén en warehouse origen
4. Origen != Destino
5. Warehouses existen

**Lógica de Transferencia:**
- **BULK**: Reduce cantidad en `stock_bulk` origen, aumenta en destino (crea si no existe)
- **SERIALIZED**: Actualiza `warehouse_id` de cada `serial_item`
- Registra movimientos en `stock_movements` (1 por BULK, 1 por cada serial en SERIALIZED)

### Stock Adjustments

#### `POST /api/inventory/adjustments`
Registrar ajustes de stock (compras, correcciones, ingresos iniciales).

**Request Body:** `StockAdjustmentRequest`
```json
{
  "product_id": 10,
  "warehouse_id": 1,
  "quantity": 200.0,
  "movement_type": "PURCHASE",  // PURCHASE o ADJUSTMENT
  "reference": "Compra - Proveedor Siemens #PO-2025-001",
  "notes": "Lote de cable UTP Cat 6 para instalaciones Enero 2025"
}
```

**Response:** `StockAdjustmentResponse`
```json
{
  "success": true,
  "movement_id": 42,
  "stock_bulk_id": 15,
  "previous_quantity": 150.0,
  "new_quantity": 350.0,
  "message": "Stock ajustado exitosamente. 150.0 → 350.0 (+200.0)"
}
```

**Validaciones:**
- `product_id` debe existir y ser tipo BULK (no aplica a SERIALIZED)
- `warehouse_id` debe existir
- `quantity` debe ser > 0
- `movement_type` solo permite `PURCHASE` o `ADJUSTMENT`

**Comportamiento:**
- Si existe registro en `stock_bulk` para ese warehouse+producto → suma la cantidad
- Si NO existe → crea nuevo registro con la cantidad especificada
- Siempre registra movimiento en `stock_movements` con:
  - `from_warehouse_id = NULL` (no hay origen en ajustes)
  - `to_warehouse_id = warehouse_id` (destino del ajuste)
  - `movement_type` = PURCHASE o ADJUSTMENT según request
  - `user_id` = usuario autenticado

**Casos de Uso:**
1. **Compra de materiales**: `movement_type=PURCHASE` para registrar nueva adquisición
2. **Corrección de inventario**: `movement_type=ADJUSTMENT` para ajustes por conteo físico
3. **Stock inicial**: Cargar cantidades al configurar sistema por primera vez

**Diferencia con `/transfer`:**
- `/transfer`: Mueve stock existente entre dos warehouses (requiere origen y destino)
- `/adjustments`: Crea/modifica stock directamente en un warehouse (no requiere origen)

### Stock Movements (Auditoría)

#### `GET /api/inventory/movements`
Listar movimientos históricos.

**Query Params:**
- `product_id` (optional): Filtrar por producto
- `warehouse_id` (optional): Filtrar por warehouse (origen O destino)
- `movement_type` (optional): Filtrar por tipo
- `limit` (default: 50, max: 500)
- `offset` (default: 0)

**Response:** `List[StockMovementResponse]`
```json
[
  {
    "id": 55,
    "product_id": 20,
    "product_name": "ONU GPON Huawei HG8546M",
    "product_sku": "ONU-HW-8546",
    "from_warehouse_id": 1,
    "from_warehouse_name": "Depósito Central",
    "to_warehouse_id": 3,
    "to_warehouse_name": "Camioneta Juan",
    "quantity": null,
    "serial_item_id": 101,
    "serial_number": "HWONU123456",
    "movement_type": "TRANSFER",
    "reference": "Carga camioneta técnico Juan",
    "notes": "Instalaciones programadas día Lunes",
    "user_id": 1,
    "user_name": "Admin",
    "date": "2025-01-12T14:30:00"
  }
]
```

## Casos de Uso Operativos

### 1. Compra de Materiales (Nuevo Stock)

**Contexto**: Llegó compra de 500 metros de cable al depósito central.

```bash
# Registrar ingreso de stock usando endpoint de ajustes
POST /api/inventory/adjustments
{
  "product_id": 10,  // Cable UTP Cat6
  "warehouse_id": 1,  // Depósito Central
  "quantity": 500.0,
  "movement_type": "PURCHASE",
  "reference": "Orden de Compra #PO-2025-123",
  "notes": "Proveedor Siemens - Factura #A-45678"
}

# Response incluye:
# - previous_quantity: 0.0 (si es la primera vez)
# - new_quantity: 500.0
# - movement_id: 42 (para auditoría)
```

### 2. Carga de Camioneta Técnico

**Contexto**: Técnico Juan necesita 3 ONUs y 100m de cable para instalaciones del día.

```bash
# 1. Transferir cable (BULK)
POST /api/inventory/transfer
{
  "product_id": 10,  // Cable UTP Cat6
  "from_warehouse_id": 1,  // Depósito Central
  "to_warehouse_id": 3,  // Camioneta Juan
  "quantity": 100.0,
  "reference": "Carga diaria Juan - 12/01/2025"
}

# 2. Transferir ONUs (SERIALIZED)
POST /api/inventory/transfer
{
  "product_id": 20,  // ONU HG8546M
  "from_warehouse_id": 1,
  "to_warehouse_id": 3,
  "serial_item_ids": [101, 102, 103],
  "reference": "Carga diaria Juan - 12/01/2025"
}

# 3. Consultar stock actualizado de camioneta
GET /api/inventory/warehouses/3/stock
```

### 3. Instalación en Cliente

**Contexto**: Se instala ONU en cliente, debe marcar serial como INSTALLED y asociar a ticket.

```bash
# 1. Actualizar serial item (esto lo hará el módulo de Tickets)
PATCH /api/inventory/serial-items/101
{
  "status": "INSTALLED",
  "ticket_id": 456,  // Ticket de instalación
  "warehouse_id": 99  // Warehouse virtual "Instalado en Cliente"
}

# Esto creará movimiento automático:
# - from_warehouse_id: 3 (Camioneta Juan)
# - to_warehouse_id: 99 (Instalado en Cliente)
# - movement_type: CONSUMPTION
```

### 4. Corrección de Inventario

**Contexto**: Conteo físico detectó diferencias, hay 475m de cable en lugar de 500m.

```bash
# Opción 1: Ajuste por diferencia (restando 25m)
POST /api/inventory/adjustments
{
  "product_id": 10,
  "warehouse_id": 1,
  "quantity": -25.0,  // Cantidad negativa para restar
  "movement_type": "ADJUSTMENT",
  "reference": "Corrección por conteo físico 2025-01-12",
  "notes": "Diferencia detectada: teórico 500m, real 475m"
}

# Nota: Backend valida quantity > 0, para correcciones negativas
# se puede implementar ADJUSTMENT_NEGATIVE en futuro release
```

### 5. Alerta de Stock Bajo

**Consulta SQL para productos bajo mínimo:**
```sql
-- Para productos BULK
SELECT 
    p.name, 
    p.sku, 
    p.min_stock_alert,
    COALESCE(SUM(sb.quantity), 0) as stock_actual
FROM products p
LEFT JOIN stock_bulk sb ON sb.product_id = p.id
WHERE p.type = 'BULK'
GROUP BY p.id
HAVING COALESCE(SUM(sb.quantity), 0) < p.min_stock_alert;

-- Para productos SERIALIZED
SELECT 
    p.name, 
    p.sku, 
    p.min_stock_alert,
    COUNT(si.id) as stock_actual
FROM products p
LEFT JOIN serial_items si ON si.product_id = p.id 
    AND si.status IN ('NEW', 'USED')
WHERE p.type = 'SERIALIZED'
GROUP BY p.id
HAVING COUNT(si.id) < p.min_stock_alert;
```

## Integración con Otros Módulos

### Módulo de Tickets
- Al crear Work Order de instalación, verificar stock disponible en warehouse del técnico asignado
- Al cerrar Work Order exitosa, actualizar `serial_items.status = 'INSTALLED'` y asociar `ticket_id`
- Registrar consumo de materiales BULK (cable usado, conectores, etc.)

### Módulo de Usuarios
- Campo `user.assigned_warehouse_id` para asignar warehouse MOBILE por defecto a técnicos
- Endpoint `GET /users/{user_id}/warehouse` para obtener stock del técnico

### Módulo de Compras (Futuro)
- Al confirmar orden de compra, crear movimientos PURCHASE hacia warehouse central
- Asociar `stock_movements.reference` con número de orden de compra

## Próximos Pasos de Implementación

### Backend (COMPLETO ✅)
- [x] Migración Alembic con 5 tablas y 4 enums
- [x] Modelos SQLAlchemy 2.0 con relaciones
- [x] Schemas Pydantic v2 con validaciones
- [x] Router con 8 endpoints funcionales
- [x] Registro en `main.py` y `models/__init__.py`
- [x] Migración ejecutada en BD (tablas verificadas)

### Frontend (PENDIENTE)
- [ ] Crear vista de gestión de warehouses
- [ ] Vista de catálogo de productos con filtros
- [ ] Vista de stock por warehouse (tabla unificada BULK+SERIALIZED)
- [ ] Modal/wizard de transferencia de stock con validaciones en tiempo real
- [ ] Vista de auditoría de movimientos con filtros y búsqueda
- [ ] Dashboard de alertas de stock bajo
- [ ] Integración con módulo de tickets (instalación/consumo)

### Testing
- [ ] Tests unitarios de validaciones críticas (transfer endpoint)
- [ ] Tests de integridad referencial (cascades, constraints)
- [ ] Tests de casos de borde (stock negativo, transferencias duplicadas)

## Notas Técnicas

### Performance
- Índices creados en: `warehouses.type`, `warehouses.user_id`, `products.sku`, `products.type`, `serial_items.serial_number`, `serial_items.status`, `stock_movements.date`
- Constraint UNIQUE en `stock_bulk(warehouse_id, product_id)` para evitar duplicados
- Usar `joinedload()` en queries para evitar N+1 queries

### Seguridad
- TODO: Implementar autenticación JWT en `_get_user_id_from_request()`
- Validar permisos: solo admin puede crear/editar productos
- Validar permisos: técnicos solo pueden transferir desde/hacia su warehouse asignado
- Auditoría completa: todos los movimientos registran `user_id`

### Integridad de Datos
- Cascades configuradas:
  - `stock_bulk.warehouse_id`: ON DELETE CASCADE (si se elimina warehouse, se elimina stock)
  - `serial_items.warehouse_id`: ON DELETE RESTRICT (no permitir eliminar warehouse con seriales)
  - `stock_movements.warehouse_id`: ON DELETE SET NULL (preservar histórico)
- Validaciones en API:
  - Stock suficiente antes de transferir
  - Seriales únicos globalmente
  - SKUs únicos globalmente

---

**Fecha de Creación**: 12 de Enero 2025  
**Autor**: GitHub Copilot  
**Versión**: 1.0
