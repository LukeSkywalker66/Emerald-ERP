# Frontend Integration - Tickets V2.0 ✅

## Status: COMPLETE
- **Commit:** `f9c3c67`
- **Branch:** `feature/new-navigation`
- **Date:** 2 de Enero de 2026

## Summary
Integración completada del frontend con la API real de Tickets V2.0. Las páginas ahora consumen datos del backend en lugar de usar mocks.

## Archivos Modificados

### 1. `frontend/src/services/tickets.service.js` (NEW - 81 líneas)
**Función:** Capa centralizada de comunicación con API

**Métodos:**
- `getAll(filters)` - GET `/api/v2/tickets` con filtros opcionales
- `getById(id)` - GET `/api/v2/tickets/{id}` para detalle
- `create(payload)` - POST `/api/v2/tickets` con datos de ticket
- `createWorkOrder(ticketId, payload)` - POST `/api/v2/tickets/{id}/work-orders`

**Características:**
- Manejo de errores con try-catch
- Logging en consola para debugging
- Parámetros validados en el nivel de API
- Integración con axios client configurado en `/api/client.js`

---

### 2. `frontend/src/pages/TicketsPage.jsx` (UPDATED)
**Función:** Página de listado de tickets

**Cambios Principales:**
- ✅ Reemplazado array `mockTickets` con estado `tickets` (useState)
- ✅ Agregado `useEffect` que llama a `ticketsService.getAll()` en mount
- ✅ Implementados estados de carga: `isLoading`, `isRefreshing`, `error`
- ✅ Nuevo dialog para crear tickets con formulario
- ✅ `handleCreateSubmit` → llama a `ticketsService.create()` → recarga lista
- ✅ Filtros en tiempo real sobre datos reales del API
- ✅ Hardcoded `connection_id: 1` (TODO: implementar selector de conexiones)

**UI Enhancements:**
- Spinner de carga mientras se obtienen datos
- Mensaje de error si la carga falla
- Dialog para crear nuevo ticket (subject, description, priority)
- Tabla actualizada con campos reales del API (creator_name, assigned_to_name, created_at)
- StatusBadge y PriorityBadge componentes helper

**State Management:**
```javascript
const [tickets, setTickets] = useState([])              // Lista de tickets del API
const [searchQuery, setSearchQuery] = useState('')      // Filtro de búsqueda
const [isLoading, setIsLoading] = useState(true)        // Indicador de carga inicial
const [isRefreshing, setIsRefreshing] = useState(false) // Indicador de actualización
const [error, setError] = useState(null)                // Mensaje de error
const [showCreateDialog, setShowCreateDialog] = useState(false) // Modal crear ticket
const [isSubmitting, setIsSubmitting] = useState(false) // Indicador envío form
const [formData, setFormData] = useState({...})         // Datos del formulario
```

---

### 3. `frontend/src/pages/TicketDetailPage.jsx` (UPDATED)
**Función:** Página de detalle de ticket individual

**Cambios Principales:**
- ✅ Reemplazado `mockTicket` con estado `ticket` (useState)
- ✅ Agregado `useParams()` para extraer ID de la URL
- ✅ Implementado `useEffect` que llama a `ticketsService.getById(id)` en mount
- ✅ Nueva funcionalidad: solicitar visita técnica → crea WorkOrder
- ✅ `handleRequestVisit()` → llama a `ticketsService.createWorkOrder()` → recarga ticket
- ✅ Componentes `WorkOrderCard` y `TimelineItem` para renderizar datos reales

**Componentes Adicionales:**
- **WorkOrderCard:** Renderiza órdenes de trabajo con estado, técnico asignado, fecha
- **TimelineItem:** Renderiza eventos de timeline (NOTE, STATUS_CHANGE, OT_EVENT, ALERT)

**State Management:**
```javascript
const [ticket, setTicket] = useState(null)              // Datos del ticket
const [isLoading, setIsLoading] = useState(true)        // Indicador de carga
const [error, setError] = useState(null)                // Mensaje de error
const [showVisitDialog, setShowVisitDialog] = useState(false) // Modal visita técnica
const [isSubmittingWO, setIsSubmittingWO] = useState(false)   // Indicador creación OT
```

**Features:**
- Vista en 2 columnas (contenido principal + sidebar con acciones)
- Timeline ordenado por fecha descendente
- Órdenes de trabajo con indicador visual de estado
- Dialog de confirmación para solicitar visita
- Carga de datos asincrónica con error handling
- Botón "Volver a tickets" para retornar a listado

---

## API Endpoints Utilizados

### GET `/api/v2/tickets`
```javascript
// Request
const response = await ticketsService.getAll({
  status: 'open',
  priority: 'high',
  limit: 50,
  offset: 0
});

// Response
[
  {
    id: 1,
    subject: "Corte de fibra",
    status: "open",
    priority: "critical",
    created_at: "2026-01-02T10:30:00",
    creator_name: "Admin User",
    assigned_to_name: "Juan Pérez",
    connection_id: 1,
    ...
  },
  ...
]
```

### GET `/api/v2/tickets/{id}`
```javascript
// Request
const ticket = await ticketsService.getById(1);

// Response
{
  id: 1,
  subject: "Corte de fibra",
  status: "open",
  priority: "critical",
  description: "Detalles...",
  created_at: "2026-01-02T10:30:00",
  creator_name: "Admin User",
  assigned_to_name: "Juan Pérez",
  connection_id: 1,
  timeline: [
    {
      id: 1,
      event_type: "NOTE",
      content: "Inicial...",
      created_at: "2026-01-02T10:30:00",
      author_name: "Admin User"
    },
    ...
  ],
  work_orders: [
    {
      id: 1,
      status: "pending_planning",
      technician_name: null,
      scheduled_at: null
    },
    ...
  ]
}
```

### POST `/api/v2/tickets`
```javascript
// Request
await ticketsService.create({
  subject: "Nuevo incidente",
  description: "Descripción...",
  priority: "medium",
  connection_id: 1
});

// Creates ticket + initial timeline NOTE event
```

### POST `/api/v2/tickets/{id}/work-orders`
```javascript
// Request
await ticketsService.createWorkOrder(ticketId, {
  ot_type: "repair",
  notes: "Solicitud de visita técnica"
});

// Creates WorkOrder in PENDING_PLANNING status + timeline OT_EVENT
```

---

## Testing Checklist

### Frontend Pages
- [ ] `TicketsPage` carga lista de tickets desde API
- [ ] Filtro de búsqueda funciona sobre datos reales
- [ ] Dialog "Crear ticket" envía datos al API
- [ ] Nuevo ticket aparece en la lista después de crear
- [ ] Clics en filas navegan a `/app/tickets/{id}`
- [ ] Spinner muestra durante carga
- [ ] Errores se muestran correctamente

### Ticket Detail
- [ ] `TicketDetailPage` carga datos del API por ID
- [ ] Timeline se renderiza correctamente (ordenado por fecha)
- [ ] WorkOrders se muestran con estado
- [ ] Botón "Solicitar Visita" crea WorkOrder vía API
- [ ] Después de crear visita, timeline se actualiza
- [ ] Botón "Volver" retorna a listado

### API Integration
- [ ] axios client está configurado en `/api/client.js`
- [ ] baseURL es `/api` (para desarrollo) o URL completa (producción)
- [ ] Headers de autenticación se envían automáticamente
- [ ] Manejo de errores 404, 500, etc.

---

## Known Limitations / TODO

1. **Connection ID hardcodeado**
   - Actualmente: `connection_id: 1` en TicketsPage
   - TODO: Implementar dropdown/selector de conexiones
   - Requiere: Nuevo endpoint GET `/api/connections` o similar

2. **Close Ticket Dialog**
   - Botón presente pero no implementado
   - TODO: Crear endpoint PATCH `/api/v2/tickets/{id}/close`
   - TODO: Implementar `ticketsService.closeTicket(id)`

3. **Pagination en Listado**
   - TODO: Implementar limit/offset en TicketsPage
   - TODO: Agregar controles de navegación (prev/next)

4. **Real-time Updates**
   - TODO: Implementar WebSocket para actualizaciones en tiempo real
   - TODO: Agregar Socket.io o similar

5. **Status/Priority Filters**
   - Dropdowns presentes pero no conectados al estado
   - TODO: Implementar `handleFilterChange()` para actualizar query

---

## Architecture Diagram

```
TicketsPage.jsx
├─ useEffect → loadTickets()
│  └─ ticketsService.getAll(filters)
│     └─ GET /api/v2/tickets
│        └─ axios client
│           └─ baseURL: /api
│
├─ handleCreateSubmit()
│  └─ ticketsService.create(payload)
│     └─ POST /api/v2/tickets
│        └─ setTickets(data)
│
└─ navigate(/app/tickets/{id})
   └─ TicketDetailPage.jsx
      ├─ useParams → id
      ├─ useEffect → loadTicket(id)
      │  └─ ticketsService.getById(id)
      │     └─ GET /api/v2/tickets/{id}
      │
      └─ handleRequestVisit()
         └─ ticketsService.createWorkOrder(id, payload)
            └─ POST /api/v2/tickets/{id}/work-orders
               └─ setTicket(updated)
```

---

## Files Committed

```bash
# Commit f9c3c67
feat: integrate real API in Tickets pages, replace mock data with ticketsService calls

 frontend/src/services/tickets.service.js      (NEW - 81 lines)
 frontend/src/pages/TicketsPage.jsx            (UPDATED - replaced 1103 lines with new version)
 frontend/src/pages/TicketDetailPage.jsx       (UPDATED - replaced 748 lines with new version)
```

---

## Next Steps

1. **Docker Testing:** `docker compose up -d` y verificar en http://localhost:5173
2. **Manual Testing:** Crear tickets, ver en listado, abrir detalle
3. **Connection Selector:** Implementar dropdown dinámico
4. **WebSocket:** Agregar actualizaciones en tiempo real
5. **Pagination:** Agregar soporte para grandes listados

---

**Session Complete:** ✅ Frontend integration con API real finalizada
**Status:** Ready for testing in Docker environment
