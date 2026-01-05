@workspace ESTE ES EL CONTEXTO ACTUAL DE BASE DE DATOS Y RELACIONES.
Úsalo como fuente de verdad absoluta para generar código.

# 🗺️ EMERALD ERP: MAPA DE DATOS (V3.0 - Consolidated)

## 1. DOMINIO INFRAESTRUCTURA (Sincronizado de ISPCube/Mikrotik)
Tablas que definen la red y los clientes. Son "Read-Only" para el módulo de operaciones.

* **`connections`** (Eje Central)
  - `connection_id` (PK, Int): ID del servicio.
  - `customer_id` (FK -> `clientes.id`).
  - `node_id` (FK -> `nodes.node_id`).
  - `plan_id` (FK -> `plans.plan_id`).
  - `pppoe_username` (String, Index): Link lógico con Mikrotik/OLT.
  - `direccion`: Domicilio de instalación.

* **`clientes`**
  - `id` (PK), `name`, `code`, `doc_number`, `status`.

* **`plans`** (Planes de Velocidad)
  - `plan_id` (PK), `name` (ej: "Fibra 300M"), `speed` (ej: 300).

* **`nodes`** (Torres/Nodos)
  - `node_id` (PK), `name`, `ip_address` (Router Borde).

* **`ppp_secrets`** (Estado Mikrotik)
  - `name` (PK, = pppoe_username), `router_ip`.

---

## 2. DOMINIO OPERACIONES (Tickets V2 & OTs)
Tablas transaccionales gestionadas por Emerald.

* **`tickets_v2`** (Incidentes)
  - `id` (PK, Int).
  - `connection_id` (FK -> `connections.connection_id`): **VITAL.** Vincula el reclamo a la conexión física.
  - `status` (Enum: open, pending, resolved, closed).
  - `priority` (Enum: low, medium, high, critical).
  - `creator_id`, `assigned_to_id` (FKs -> `users.id`).

* **`ticket_timeline`** (Bitácora Unificada)
  - `ticket_id` (FK), `author_id` (FK).
  - `event_type` (Enum: note, alert, ot_event, status_change).
  - `content` (Text), `meta_data` (JSONB).

* **`work_orders`** (Órdenes de Trabajo)
  - `id` (PK).
  - `ticket_id` (FK).
  - `technician_id` (FK -> `users.id`).
  - `status` (Enum: pending_planning, assigned, in_progress, completed).
  - `ot_type` (Enum: repair, install, pickup).
  - `scheduled_at`, `completed_at`.

* **`work_order_items`** (Materiales)
  - `work_order_id` (FK).
  - `product_id` (Ref a stock), `quantity`, `serial_number`.

---

## 🔗 RELACIONES CLAVE PARA QUERIES

1. **Ticket -> Cliente Completo:**
   `tickets_v2` JOIN `connections` ON `connection_id`
   JOIN `clientes` ON `customer_id`
   JOIN `plans` ON `plan_id`
   LEFT JOIN `nodes` ON `node_id`.

2. **Validar Estado Técnico de un Ticket:**
   Usar `tickets_v2.connection_id` -> `connections.pppoe_username` -> Buscar en `ppp_secrets` (Online/Offline) o `subscribers` (Datos ONU).

## ⚠️ REGLAS DE NEGOCIO
1. Un Ticket SIEMPRE pertenece a una `connection_id` (no al cliente directo).
2. Las OTs se derivan de un Ticket, no existen solas (por ahora).
3. El `ticket_timeline` es la única fuente de verdad histórica del incidente.