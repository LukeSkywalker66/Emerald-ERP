# CHECKPOINT 23-ENE-2026

## Resumen del trabajo
- Añadida tabla `ticket_reasons` y FK opcional `ticket_reason_id` en `tickets` (Alembic manual: `add_ticket_reasons`).
- Endpoint nuevo `GET /api/v2/tickets/reasons?category_id={id}` expone motivos filtrados por categoría.
- Seeds ejecutados con motivos iniciales en 4 categorías (Falla Técnica, Administrativo, Traslado, Baja). Instalación sin motivos.
- Frontend: wizards de creación de tickets consumen motivos dinámicos, select en cascada y asunto automático `[Motivo] - Cliente`.

## Detalle técnico
- Migración aplicada: `alembic upgrade add_ticket_reasons`.
- Script de seeds: `docker exec emerald_backend python -m scripts.seed_ticket_reasons`.
- API reasons: backend en puerto 8500 (`/api/v2/tickets/reasons`). Validación: motivo debe pertenecer a la categoría.
- Frontend actualizado (Vite/HMR activo) en wizards: Technical, Administrative, Withdrawal, Relocation. Installation sin cambios.

### Seeds cargados (IDs actuales en BD)
- Falla Técnica (cat_id=1): Sin Servicio, Intermitencia/Microcortes, Lentitud, Problema WiFi.
- Administrativo (cat_id=2): Cambio de Plan/Servicio, Cambio de Titularidad, Facturación.
- Traslado (cat_id=4): Traslado Interno, Traslado a otro domicilio.
- Baja (cat_id=5): Precio/Competencia, Disconformidad Técnica, Mudanza, Fallecimiento.

## Cómo probar rápido
1) Backend ya corriendo en `emerald_backend` (puerto 8500). Verificar motivos:
   - `curl -s "http://localhost:8500/api/v2/tickets/reasons?category_id=1"`
2) Frontend en `emerald_frontend` (Vite). Abrir modal de nuevo ticket:
   - Seleccionar categoría → select de Motivo aparece (menos en Instalación).
   - Al elegir motivo y cliente, asunto se autocompleta `[Motivo] - Cliente`.

## Pendientes / próximos pasos
- Ajustar UI final (validaciones visuales, textos) según feedback de pruebas.
- Ejecutar pruebas de creación de ticket end-to-end en entorno staging.
- Si se agregan nuevas categorías/motivos, actualizar seed y volver a correr script.

## Rutas clave
- Backend: `backend/alembic/versions/add_ticket_reasons.py`, `backend/scripts/seed_ticket_reasons.py`, `backend/src/routers/tickets.py` (endpoint y validación), `backend/src/models/__init__.py` (export `TicketReason`).
- Frontend: servicio `frontend/src/services/tickets.service.js` (getReasons), wizards en `frontend/src/components/tickets/wizards/`.
