# CHECKPOINT 2026-02-02: WorkOrders + Coordinación (Agendamiento)

**Status:** ✅ COMPLETADO

**Fecha:** 2 de Febrero 2026  
**Rama:** `develop`

---

## 📌 Objetivo
Preparar el modelo `work_orders` para soportar agendamiento, asignación de cuadrillas y duración estimada. Además, corregir un error de backend que causaba timeouts por fallo de arranque.

---

## ✅ Cambios Implementados

### 1) Backend - Modelos (SQLAlchemy 2.0)
**Archivo:** `backend/src/models/tickets.py`
- ✅ `WorkOrderStatus` actualizado con estados:
  - `coordinated` (fecha pactada sin cuadrilla)
  - `scheduled` (fecha pactada con cuadrilla)
- ✅ Nuevos campos en `WorkOrder`:
  - `team_id` (FK a `teams.id`)
  - `scheduled_start` / `scheduled_end` (timezone-aware)
  - `estimated_duration` (default 60)
  - `coordination_notes`
- ✅ Relación `team` hacia `Team`
- ✅ Índice compuesto `ix_work_orders_team_scheduled`
- ✅ Helpers: `is_coordinated`, `is_team_assigned`, `calculate_scheduled_end()`

### 2) Backend - Router WorkOrders
**Archivo:** `backend/src/routers/work_orders.py`
- ✅ `get_work_order_detail` incluye `team` y nuevos campos
- ✅ `update_work_order`:
  - calcula `scheduled_end` automáticamente
  - transición automática a `coordinated` / `scheduled`
  - meta_data de timeline incluye `team_id` y `scheduled_start`

### 3) Backend - Schemas (Pydantic)
**Archivo:** `backend/src/schemas/tickets.py`
- ✅ `WorkOrderUpdate` permite modificar campos de coordinación
- ✅ `WorkOrderDetailResponse` y `WorkOrderListResponse` incluyen nuevos campos

### 4) Backend - Coordinación (Relación inversa)
**Archivo:** `backend/src/models/coordination.py`
- ✅ `Team.work_orders` agregado
- ✅ Eliminados `comment` inválidos en relationships (fix de crash)

### 5) Migraciones (Alembic)
- ✅ `2026_02_02_002_add_coordination_to_work_orders.py`
- ✅ Merge de heads: `7b7dfe8236f8_merge_coordination_and_ticket_reasons_.py`
- ✅ Aplicado con `alembic upgrade heads`

---

## 🛠️ Fix Crítico (Timeouts)
**Síntoma:** Timeouts al cargar tickets/usuarios en UI.

**Causa:** Backend no iniciaba por error:
```
RelationshipProperty.__init__() got an unexpected keyword argument 'comment'
```

**Solución:** Remover `comment` de relationships en:
- `Team.members`
- `Team.work_orders`

**Resultado:** Backend estable, requests ya no timeout.

---

## 🗂️ Documentación Actualizada
- ✅ MASTER_CONTEXT.md
- ✅ AI_ARCHITECT_CONTEXT.md
- ✅ docs/BASE_DATOS.md

---

## 🔎 Commits Relevantes
- `feat(work-orders): agregar campos de coordinación para Teams`
- `docs: actualizar contexto con decisión D13 (agendamiento de WorkOrders)`
- `fix(coordination): eliminar comment en relationships SQLAlchemy`

---

## ▶️ Próximos Pasos Sugeridos
1) Actualizar endpoints específicos de coordinación (si se separan de PATCH general)
2) UI de agenda de cuadrillas (drag & drop)
3) Tests E2E para flujos de coordinación

---

## ✅ Actualización 2026-02-05
- UI de agenda de cuadrillas con drag & drop funcional.
- Drop capturado a nivel de fila para permitir soltar sobre la misma OT sin bloquear eventos.
- Se mantiene granularidad de 5 minutos, validación de colisiones y resize existentes.

**Estado final:** Sistema operativo, backend estable, modelos listos para agenda de coordinación.
