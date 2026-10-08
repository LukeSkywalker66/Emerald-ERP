# Plan: Flujos de ticket carrier-class + Mesh + Servicio Técnico

## Contexto

1. El "Pase a Fibra" existe en código (enum, wizard, auto-OT), pero la UI lo
   resolvía por **nombre de categoría** con substrings en
   [`CreateTicketDialog.resolveFlow()`](../../frontend/src/components/tickets/CreateTicketDialog.jsx:89).
   No había categoría "Pase a Fibra" en `ticket_categories` → flujo inalcanzable.
2. Se quiere robustecer: mapeo categoría → flujo **data-driven** (columna `flow_key`).
3. Nuevo servicio **Mesh**: tecnología de instalación más (no un tipo de ticket nuevo).
4. Renombrar "Falla Técnica" → "Servicio Técnico" y ampliar sus motivos.

## Decisiones acordadas

- **Mesh**: NO es un `TicketType` nuevo. Se agrega como `installation_tech = 'mesh'`
  en la tabla `installation_types`. El wizard de Instalación ya carga el dropdown
  desde `/v2/installation-types`, así que aparece solo.
- **OT de mesh**: reutiliza `install_aire` (wireless). Se actualiza el mapeo de
  [`create_ticket()`](../../backend/src/routers/tickets.py:744) para que
  `wireless` **y** `mesh` → `install_aire`.
- **Servicio Técnico**: es renombre de categoría + motivos (`ticket_reasons`),
  no un tipo nuevo. El [`TechnicalWizard`](../../frontend/src/components/tickets/wizards/TechnicalWizard.jsx:31)
  ya carga motivos por categoría y los muestra en dropdown.

## Fase 1 — `flow_key` en categorías (carrier-class)

1. Migración `2026_10_07_001_add_ticket_category_flow_key.py`:
   - `ALTER TABLE ticket_categories ADD COLUMN flow_key VARCHAR(40)`.
   - Backfill idempotente por nombre:
     - `Falla Técnica` / `Servicio Técnico` → `technical`
     - `Administrativo` → `administrative`
     - `Instalación` → `installation`
     - `Traslado` → `relocation`
     - `Baja` → `withdrawal`
     - `Pase a Fibra` → `fiber_migration`
2. Modelo [`TicketCategory.flow_key`](../../backend/src/models/tickets.py:231).
3. Schema [`TicketCategoryResponse`](../../backend/src/schemas/tickets.py) + `flow_key`.
4. Frontend [`CreateTicketDialog.resolveFlow()`](../../frontend/src/components/tickets/CreateTicketDialog.jsx:89):
   usar `cat.flow_key`, con fallback al parser por nombre para categorías viejas.
5. [`seed_tickets.py`](../../backend/scripts/seed_tickets.py:19): categorías con `flow_key`.

## Fase 2 — Mesh como tecnología de instalación

6. Migración `2026_10_07_002_add_mesh_installation_type.py` (data, idempotente):
   `INSERT INTO installation_types (code, name, description, is_active)`
   → `('mesh', 'Mesh (red inalámbrica)', '...', true)`.
7. [`create_ticket()`](../../backend/src/routers/tickets.py:744): mapeo
   `installation_tech IN ('wireless','mesh') → WorkOrderType.install_aire`.
8. Verificar dropdown del [`InstallationWizard`](../../frontend/src/components/tickets/wizards/InstallationWizard.jsx:20)
   (sin cambios de código; carga desde API).

## Fase 3 — Servicio Técnico (renombre + motivos)

9. Migración (o en la Fase 1): `UPDATE ticket_categories SET name='Servicio Técnico'
   WHERE name='Falla Técnica'` (idempotente).
10. [`seed_ticket_reasons.py`](../../backend/scripts/seed_ticket_reasons.py:17):
    motivos de "Servicio Técnico":
    - Sin Servicio, Intermitencia/Microcortes, Lentitud, Problema WiFi (existentes)
    - **Cambio de clave WiFi**, **Cableado de dispositivos**, **Auditar instalación** (nuevos)

## Fase 4 — Deploy y verificación

11. Aplicar migraciones en dev (`alembic upgrade head`).
12. Rebuild frontend (cambio en `CreateTicketDialog`).
13. SQL/seed para producción (migraciones corren en deploy; motivos vía seed).
14. E2E: crear "Pase a Fibra", "Instalación" con tech `mesh`, "Servicio Técnico →
    Cambio de clave WiFi".

## Fuera de alcance (notas)

- No se crea `WorkOrderType.install_mesh` (decisión del usuario). El trade-off:
  las OTs de mesh se etiquetan "Instalación Aire".
- Verificación de fecha del commit de fiber_migration requiere `git log` (modo Code).
