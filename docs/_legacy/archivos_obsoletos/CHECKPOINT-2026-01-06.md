# Checkpoint OT Module – 2026-01-06

Fecha: 2026-01-06
Rama: feature/new-navigation
Commit base: 519d272

## Alcance
- Creación de OT desde Detalle de Ticket con validación.
- Herencia automática de datos (cliente, dirección, conexión) en backend.
- Timeline del ticket con cards de OT clickeables.
- Página de Ejecución de OT (mapa, pausa/continuar, banner de sin asignar).
- Listado de OT con filtros (incluye "Sin asignar").
- Fix de JSX en WorkOrdersPage para compilar sin errores.

## Endpoints (API v2)
- POST /api/v2/work-orders
- GET /api/v2/work-orders
- GET /api/v2/work-orders/{id}
- PATCH /api/v2/work-orders/{id}

## Ubicaciones clave
- Frontend: frontend/src/pages/WorkOrdersPage.jsx
- Frontend: frontend/src/pages/TicketDetailPage.jsx
- Frontend: frontend/src/components/tickets/TicketTimeline.jsx
- Backend: backend/src/routers/work_orders.py
- Backend: backend/src/schemas/tickets.py

## Cómo retomar
1. Levantar stack con Docker Compose.
2. Abrir UI en /app/work-orders y /app/tickets.
3. Probar crear una OT desde un ticket, luego ejecutarla.

Notas: La rama fue empujada con tag de checkpoint para continuar desde otra PC.