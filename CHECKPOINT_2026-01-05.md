# 🔄 Checkpoint - Sesión 2026-01-05

## 📋 Contexto del Proyecto
**Emerald ERP** - Sistema de gestión para ISP (2F Internet) en Argentina.
- **Stack:** FastAPI + PostgreSQL 15 + SQLAlchemy 2.0 | React + Vite
- **Arquitectura:** Modular (Auth, Tickets V2, Stock, Beholder legacy)
- **Rama activa:** `feature/new-navigation`

## ✅ Trabajo Completado en esta Sesión

### 1. Sistema de Escalación y Pendientes de Infraestructura
**Backend:**
- ✅ Enum `TicketStatus`: agregado `pending_infra` (pendiente infraestructura)
- ✅ Enum `WorkOrderType`: agregado `infrastructure` (OT de infraestructura)
- ✅ Campo `availability_note` (TEXT) en tabla `tickets_v2`
- ✅ Migraciones Alembic aplicadas (5 migrations: c8a4f2c0f6a9, d7b5e1c2f8a0, fabcca987f2b, e4c5f2d1a8b9, g6e7f4d3c0b1a)
- ✅ **IMPORTANTE:** Todos los enums usan lowercase (`open`, `medium`, `repair`, etc.) - NO UPPERCASE

**Archivos modificados:**
- `backend/src/models/tickets.py` - Enums lowercase, defaults corregidos
- `backend/src/schemas/tickets.py` - TicketUpdate/Response con `availability_note`
- `backend/src/routers/tickets_v2.py` - Endpoints actualizados, manejo de timeline events

### 2. Frontend - TicketDetailPage Reescrito
**Características:**
- ✅ **Inline editing** con iconos Pencil/Check/X (estado, prioridad, asignado)
- ✅ **Diálogos de flujo:** Escalar a infra, Devolver a soporte, Cerrar ticket
- ✅ **AvailabilityEditor:** Editor inline para `availability_note`
- ✅ **Connection Details Card:** Sidebar con datos del cliente/conexión
- ✅ **Navegación:** Redirige a `/app/tickets/{id}` después de crear ticket

**Componentes creados:**
- `InlineEditableSelect` - Editor inline con iconos Pencil/Check/Cancel
- `WorkOrderCard` - Visualización de OTs con badges de tipo/estado
- `AvailabilityEditor` - Editor de horarios de disponibilidad

**UI Components agregados:**
- `frontend/src/components/ui/alert.jsx` - Componente Alert (nuevo)
- `frontend/src/components/ui/card.jsx` - Componente Card (nuevo)
- `frontend/src/components/ui/dialog.jsx` - Bug de doble render ARREGLADO

### 3. Historial de Tickets por Conexión (ÚLTIMA FEATURE)
**Backend:**
- ✅ Endpoint `GET /api/v2/tickets/by-connection/{connection_id}`
  - Params: `limit` (default 5), `exclude_ticket_id` (opcional)
  - Retorna tickets de la misma conexión, ordenados por fecha DESC
  - Ubicación: `backend/src/routers/tickets_v2.py` (línea ~153)

**Frontend:**
- ✅ `frontend/src/components/tickets/TicketHistoryCard.jsx`
  - Muestra hasta 5 tickets previos de la misma conexión
  - Click en ticket navega a su detalle
  - Estados: loading, error, vacío
  
- ✅ `frontend/src/components/tickets/RepeatedIssueAlert.jsx`
  - Detecta tickets resueltos/cerrados en últimos 7 días
  - Alerta amber prominente con detalles
  
- ✅ `frontend/src/services/tickets.service.js`
  - Método `getConnectionHistory(connectionId, options)` agregado
  
- ✅ `frontend/src/pages/TicketDetailPage.jsx`
  - Historial + alerta ubicados **debajo del detalle de conexión** (columna izquierda)
  - Solo visible si `ticket.connection_id` existe

## 🗂️ Estructura de Archivos Clave

```
backend/src/
├── models/tickets.py          # Modelos SQLAlchemy (enums LOWERCASE)
├── schemas/tickets.py         # Pydantic schemas (TicketUpdate, TicketResponse)
├── routers/tickets_v2.py      # Router con endpoints v2 + historial
├── routers/v1/auth.py         # Autenticación (OAuth2PasswordRequestForm)
└── database.py                # Session factory

frontend/src/
├── pages/
│   ├── TicketDetailPage.jsx   # Página de detalle REESCRITA
│   ├── TicketsPage.jsx        # Lista de tickets
│   └── LoginPage.jsx          # Copy: "Sistema de gestión 2F Internet"
├── components/
│   ├── tickets/
│   │   ├── TicketHistoryCard.jsx      # Historial de conexión
│   │   └── RepeatedIssueAlert.jsx     # Alerta de problema recurrente
│   └── ui/
│       ├── alert.jsx          # Nuevo
│       ├── card.jsx           # Nuevo
│       └── dialog.jsx         # Bug fix aplicado
└── services/
    └── tickets.service.js     # Métodos API (getConnectionHistory)
```

## 🔧 Comandos Útiles

```bash
# Reiniciar servicios
cd /opt/emerald-erp
docker compose restart backend
docker compose restart frontend

# Ver logs
docker logs emerald_backend --tail 50
docker logs emerald_frontend --tail 50

# Consulta DB
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "SELECT ..."

# Test endpoint historial
curl -s "http://localhost:8500/api/v2/tickets/by-connection/1?limit=5&exclude_ticket_id=15"

# Estado contenedores
docker ps | grep emerald
```

## 🐛 Bugs Conocidos Resueltos

1. ✅ **Enum case mismatch:** Enums tenían UPPERCASE en código pero lowercase en DB → Cambiados todos a lowercase
2. ✅ **Dialog double render:** {children} renderizado dos veces → Removido duplicado
3. ✅ **Missing UI components:** Alert y Card no existían → Creados
4. ✅ **Navigation after create:** No redirigía → Agregado navigate() en TicketsPage.jsx

## 📊 Estado de la Base de Datos

**Usuarios existentes:**
```
id=2, username=admin, email=admin@emerald.com
id=6, username=operador1, email=operador1@emerald.com
id=7-9: operador2, tecnico1, tecnico2
```

**Tickets de prueba:**
```
#8  - Velocidad baja (CLOSED, connection_id=1)
#9  - Consulta sobre facturación (OPEN, connection_id=1)
#11 - Test ticket escalation (PENDING, connection_id=1)
#15 - Nuevo problema mismo cliente (OPEN, connection_id=1)
```

## 🎯 Próximos Pasos Sugeridos

1. **Testing visual completo** del historial en el frontend (https://localhost/app/tickets/15)
2. **Agregar filtros avanzados** al historial (por estado, prioridad, rango de fechas)
3. **Notificaciones** cuando se detecte problema recurrente
4. **Métricas de SLA** para conexiones problemáticas
5. **Export a Excel/PDF** del historial de una conexión
6. **Dashboard** de conexiones con más incidentes

## ⚠️ Notas Importantes

### Enums - SIEMPRE LOWERCASE
```python
# ✅ CORRECTO
TicketStatus.open
TicketPriority.medium
WorkOrderType.repair
TicketStatus.pending_infra  # Nuevo

# ❌ INCORRECTO (causará errores)
TicketStatus.OPEN
TicketPriority.MEDIUM
```

### Paths de Navegación
- Login: `/login`
- Dashboard: `/app` (redirect a `/app/tickets`)
- Lista tickets: `/app/tickets`
- Detalle ticket: `/app/tickets/{id}`
- API base: `http://localhost:8500/api`

### Autenticación
- Router: `/api/v1/auth/login` (OAuth2PasswordRequestForm)
- Campo password en DB: `hashed_password` (NO `password_hash`)
- Usuario test: `admin@emerald.com` (password desconocido, requiere reset)

### Docker Setup
- Backend: puerto 8500 interno → nginx reverse proxy
- Frontend: puerto 5173 interno → nginx reverse proxy
- PostgreSQL: 5432 (solo localhost)
- Redis: 6379 (solo localhost)
- Nginx: 80 (redirect a 443), 443 (SSL)

## 📝 Variables de Entorno Críticas

```bash
# .env (raíz del proyecto)
POSTGRES_USER=emerald_owner
POSTGRES_PASSWORD=***
POSTGRES_DB=emerald_stock
SECRET_KEY=*** (para JWT)
```

## 🎨 Paleta de Colores (Theme)

```
Emerald Glow:  #10b981 (éxito, acciones principales)
Ruby:          #dc2626 (errores, crítico)
Gold:          #f59e0b (advertencias)
Zinc oscuro:   #18181b (fondos)
Purple:        #a855f7 (pending_infra, infrastructure)
```

## 🔗 URLs Útiles

- Frontend: https://localhost/
- Backend API: http://localhost:8500/api
- PostgreSQL: localhost:5432 (solo interno)
- Docs backend: Revisar `docs/` en raíz

---

**Última actualización:** 2026-01-05 16:10 ART  
**Estado:** ✅ Sistema operativo, historial de tickets implementado y testeado  
**Pendiente:** Testing visual completo en producción
