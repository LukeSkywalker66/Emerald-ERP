# TODO Próxima Sesión Copilot (2026-02-02)

## Objetivo Principal
Dejar `docs/BASE_DATOS.md` 100% consistente con el modelo actual y avanzar integración de Coordinación ↔ WorkOrders, con pruebas E2E.

---

## 1) Auditoría y Corrección de BASE_DATOS.md (Alta prioridad)
- [ ] Comparar `docs/BASE_DATOS.md` vs modelos actuales SQLAlchemy:
  - `backend/src/models/tickets.py`
  - `backend/src/models/coordination.py`
  - `backend/src/models/inventory.py`
  - `backend/src/models/engineering.py`
  - `backend/src/models/user.py`
- [ ] Actualizar diagrama de entidades y enums:
  - WorkOrderStatus: `pending_planning`, `coordinated`, `scheduled`, `assigned`, `in_progress`, `completed`, `failed`
  - WorkOrderType: `repair`, `install`, `pickup`, `infrastructure`
  - TicketTimelineEventType: `note`, `alert`, `ot_event`, `status_change`, `file`
- [ ] Validar FKs e índices con migraciones recientes (`backend/alembic/versions/*`).
- [ ] Eliminar referencias legacy obsoletas (ej: enums antiguos, estados cancelados).

---

## 2) Coordinación ↔ WorkOrders (Integración técnica)
- [ ] Revisar endpoints actuales de WorkOrders para coordinación (PATCH general).
- [ ] Definir endpoints específicos (opcional):
  - `PUT /v2/work-orders/{id}/coordinate`
  - `PUT /v2/work-orders/{id}/assign-team`
- [ ] Confirmar lógica automática:
  - `scheduled_start + estimated_duration` → `scheduled_end`
  - `scheduled_start` sin `team_id` → `coordinated`
  - `team_id` + `scheduled_start` → `scheduled`

---

## 3) UI de Agenda (Frontend)
- [ ] Diseñar vista calendario semanal de OTs por cuadrilla.
- [ ] Drag & drop para reprogramar (update `scheduled_start`).
- [ ] Mostrar carga por equipo (número de OTs / duración total).

---

## 4) Pruebas E2E (Coordination + WorkOrders)
- [ ] Agregar pruebas Playwright para:
  - Crear cuadrilla
  - Asignar móvil + técnico
  - Crear WorkOrder → coordinar → asignar team
  - Validar cambios de estado (coordinated/scheduled/in_progress/completed)

---

## 5) QA Post-Deploy
- [ ] Verificar UI de tickets/usuarios sin timeouts.
- [ ] Chequear logs de backend y DB por queries lentas.
- [ ] Validar migraciones aplicadas en entorno actual.

---

## Notas de contexto
- Se corrigió crash por `comment` inválido en relationships SQLAlchemy.
- Backend ya levanta correctamente.
- Migraciones aplicadas: `2026_02_02_002_add_coordination_to_work_orders.py` + merge heads.

