# Memoria de Vistas por Usuario (filtros y orden persistentes)

**Fecha:** 2026-09-25
**Módulos:** Tickets, Work Orders (extensible a cualquier grilla)
**Objetivo:** Que cada usuario conserve sus filtros, orden y paginación de una
grilla al abandonarla y volver, y que esas preferencias lo sigan entre
dispositivos (fuente de verdad en el backend, no en el navegador).

---

## 1. Por qué backend y no localStorage

`localStorage` es por navegador/dispositivo y se pierde al limpiar caché. Las
aplicaciones modernas (Linear, Notion, Jira, Salesforce) guardan la
configuración de vista del usuario en el servidor para que sea cross-device y
sobreviva a cualquier limpieza local. El `localStorage` se usa aquí solo como
**caché de primera pintura** (evita el "flash" de filtros por defecto).

---

## 2. Arquitectura

```
Grilla (TicketsPage / WorkOrdersPage)
        │  usePersistedViewState(moduleKey, defaults)
        ▼
preferences.service.js  ──►  GET / PUT /api/v2/me/preferences/{module_key}
                                     │
                                     ▼
                          Tabla user_preferences (PostgreSQL, JSONB versionado)
```

### Backend

- **Tabla** `user_preferences` (migración [`2026_09_25_001_add_user_preferences.py`](../backend/alembic/versions/2026_09_25_001_add_user_preferences.py)):
  - `id` PK
  - `user_id` FK → `users.id` (ON DELETE CASCADE)
  - `module_key` VARCHAR(100) — clave del módulo (ej: `tickets.grid`)
  - `payload` JSONB — configuración libre de vista (filtros, orden, paginación)
  - `schema_version` INT (default 1) — versión del esquema del payload
  - `created_at` / `updated_at`
  - `UNIQUE(user_id, module_key)`
- **Modelo** [`UserPreference`](../backend/src/models/user.py) + relación `User.preferences`.
- **Schemas** [`UserPreferenceUpsert` / `UserPreferenceResponse`](../backend/src/schemas/user_schemas.py):
  - `payload` validado como `dict`, `schema_version ≥ 1`.
- **Endpoints** [`routers/v2/preferences.py`](../backend/src/routers/v2/preferences.py):
  - `GET  /api/v2/me/preferences/{module_key}` → payload guardado (404 si no hay)
  - `PUT  /api/v2/me/preferences/{module_key}` → upsert (crea o actualiza)

### Frontend

- **Servicio** [`preferences.service.js`](../frontend/src/services/preferences.service.js):
  `getPreference(moduleKey)` / `savePreference(moduleKey, payload, schemaVersion)`.
- **Hook** [`usePersistedViewState`](../frontend/src/hooks/usePersistedViewState.js):
  1. Primera pintura instantánea con caché `localStorage` (`emerald-view:{userId}:{moduleKey}`).
  2. Hidratación desde backend (fuente de verdad).
  3. Merge tolerante sobre `defaults`: solo pisa claves conocidas, descarta las desconocidas.
  4. Guardado debounced (600 ms) con `schema_version` ante cada cambio.
  - Retorna `[state, setState, hydrated]`.

---

## 3. Cómo agregar persistencia a un módulo nuevo

1. Definir un objeto `defaults` **estable** (declarado fuera del componente):

   ```js
   const INVENTORY_GRID_DEFAULTS = {
     search: '',
     category: '',
     sortField: 'name',
     sortDirection: 'asc',
     pageSize: 20,
   };
   ```

2. Usar el hook y derivar los campos:

   ```js
   const [view, setView] = usePersistedViewState('inventory.grid', INVENTORY_GRID_DEFAULTS);
   const search = view.search;
   const setSearch = (v) => setView((prev) => ({ ...prev, search: v }));
   ```

   Si algún setter recibe **updater funcional** (ej. `setSortDir((d) => ...)`),
   usar un helper que soporte ambos:

   ```js
   const applyViewUpdate = (key) => (updater) =>
     setView((prev) => ({
       ...prev,
       [key]: typeof updater === 'function' ? updater(prev[key]) : updater,
     }));
   const setSortDir = applyViewUpdate('sortDir');
   ```

3. Listo: los filtros/orden quedan persistidos y se restauran al volver.

**Regla:** `currentPage` NO se persiste (se resetea a 1 al recargar para evitar
paginación obsoleta). El `pageSize` sí se persiste.

---

## 4. Evolución del schema (schema_version)

Cuando cambie la forma del payload de un módulo (se renombra/agrega un filtro):

1. Subir el `schema_version` del módulo.
2. En el `defaults` del hook reflejar la nueva forma.
3. El merge tolerante descarta claves viejas y rellena las nuevas con defaults,
   sin romper a usuarios que tengan payloads de versiones anteriores.

---

## 5. Módulos integrados

| module_key        | Qué persiste |
|-------------------|--------------|
| `tickets.grid`    | búsqueda, estado, prioridad, tags, `sortField`, `sortDirection`, `pageSize` |
| `work_orders.grid`| búsqueda, estado, tipo, cuadrilla, `sortKey`, `sortDir` |

---

## 6. Bug corregido en el camino (orden por cliente en tickets)

Ordenar la grilla de tickets por "Cliente" devolvía **500** porque el backend
referenciaba `Ticket.client_name`, que **no es una columna real** (el nombre de
cliente se calcula via join `connections → clientes`).

**Fix** en [`routers/tickets.py`](../backend/src/routers/tickets.py): el
`order_by=client_name` ahora hace `outerjoin` a `connections` y `clientes` por
`connection_id` y ordena por `Cliente.name`, la misma fuente que usa la
respuesta. Verificado con `GET /api/v2/tickets?...&order_by=client_name` → 200.

---

## 7. Fuera de alcance (futuras fases)

- Reordenación de columnas drag & drop.
- Vistas guardadas compartidas por equipo.
- Validación de payload por módulo en el backend (hoy: `payload` debe ser un
  `dict` genérico; la normalización fina vive en el merge del hook).
