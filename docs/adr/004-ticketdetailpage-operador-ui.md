# ADR-004: TicketDetailPage como UI Única para Operadores

**Status:** ✅ Accepted (02/01/2026)  
**Context:** Diseño del sistema de gestión de tickets para Emerald ISP  
**Decision:** Una sola vista (`TicketDetailPage`) para operadores, no crear UI separada para técnicos

---

## Contexto del Problema

Al implementar el nuevo sistema de tickets (v2.0), surgió la pregunta:

> ¿Debemos crear dos vistas separadas?
> - Una para **Operadores** (gestión, asignación, seguimiento)
> - Una para **Técnicos** (datos técnicos, consumo de materiales)

O:

> ¿Una sola vista para Operadores que muestre toda la información?

---

## Decisión Tomada

**Crear `TicketDetailPage` como interfaz única para OPERADORES únicamente.**

La vista técnica (reparación en sitio) será responsabilidad de:
- **App móvil** (Técnico) - por implementar en futuro
- **Dashboard de Técnicos** - arquitectura separada con endpoints específicos

---

## Implementación

### TicketDetailPage (Operador)

**Archivo:** `frontend/src/pages/TicketDetailPage.jsx` (830 líneas)

**Secciones visibles para operador:**

```jsx
┌─────────────────────────────────────────────────────┐
│ Header: Ticket CNX-8821 | Cliente | Plan | Estado │
├────────────────┬────────────────────────────────────┤
│                │                                    │
│ 70% ANCHO:     │ 30% ANCHO: Sidebar (Info rápida) │
│                │                                    │
│ · Dirección    │ · Cliente                         │
│ · Plan         │ · Técnico asignado                │
│ · Badges       │ · Prioridad/Estado                │
│ · OT Monitor   │ · Timeline (5 eventos más rec.)   │
│ · Timeline     │ · Botones de acción               │
│ · Telemetría   │                                    │
│                │                                    │
└────────────────┴────────────────────────────────────┘
```

**Funcionalidades:**

1. **WorkOrderCard** - Monitoreo de OT en tiempo real
   - Estado actual (pending_planning, scheduled, in_progress, completed)
   - Técnico asignado
   - Fecha programada
   - Link a detalles

2. **TimelineItem** - Bitácora de eventos
   - Notas del operador
   - Cambios de estado
   - Alertas de telemetría
   - Eventos de OT

3. **TelemetrySnapshot** - Salud del servicio
   - ONU Status (online/offline)
   - Signal dBm (crítica, normal)
   - Infraestructura (PON zone)

4. **Diálogos interactivos**
   - "Solicitar Visita Técnica" → Crear OT
   - "Cerrar Ticket" → Resolver y documentar

---

## Beneficios de esta Decisión

| Beneficio | Explicación |
|-----------|------------|
| **Claridad** | Una vista = Una responsabilidad (operador gestiona, técnico ejecuta) |
| **Escalabilidad** | Técnico usa app móvil/dashboard separado, sin acoplamiento |
| **Datos sensibles** | No exponemos detalles de técnicos a otros operadores |
| **Performance** | Operador no carga datos técnicos innecesarios |
| **UX simplificada** | Interfaz enfocada en KPIs operacionales |

---

## Flujo de Datos

```
Operador crea Ticket (TicketsPage)
       ↓
Operador abre TicketDetailPage
       ↓
TicketDetailPage carga:
  · GET /api/v1/tickets/{id} → datos ticket
  · GET /api/v1/tickets/{id}/timeline → bitácora
  · GET /api/v1/tickets/{id}/work-orders → OTs
       ↓
Operador interactúa:
  · Clica "Solicitar Visita"
       ↓
  · Abre Dialog "Solicitar Visita"
       ↓
  · POST /api/v1/tickets/{id}/request-visit
       ↓
  · Crea WorkOrder (pending_planning)
  · Crea TicketTimeline event OT_CREATED
  · TicketDetailPage se auto-actualiza (refetch timeline)
       ↓
Operador monitorea OT:
  · Técnico actualiza estado vía API/app móvil
  · Dashboard se auto-actualiza (polling o WebSocket)
       ↓
Operador cierra Ticket:
  · Clica "Cerrar Ticket"
  · Ingresa resumen de resolución
  · POST /api/v1/tickets/{id}/close
  · Marca ticket como closed
  · Completa OTs pendientes automáticamente
```

---

## Arquitectura Visual (Tema "Emerald Orchestrator")

**Paleta:**
- **Fondos:** Zinc-900/950 (sala de máquinas)
- **Acentos:** Emerald-500 (glow de señal activa)
- **Errores:** Red-500 (peligro inmediato)
- **Advertencias:** Amber-500 (atención requerida)

**Tipografía:**
- Headers: Inter ExtraBold (misterioso, profesional)
- Body: Inter Regular (legible en densidad alta)
- Monospace: JetBrains Mono (datos técnicos)

**Densidad:** Alta (mucha información compactada)
- Rows: 40px
- Spacing: 8px/16px
- Font size: 13px/14px (body)

---

## Estructura de Componentes

```
TicketDetailPage
├── Header
│   ├── Breadcrumb
│   ├── TicketCode + Title
│   ├── ClientInfo
│   └── StatusBadges
├── MainContent (70%)
│   ├── WorkOrderCard
│   │   └── OT monitoring (real-time updates)
│   ├── TimelineSection
│   │   ├── TimelineItem (NOTE)
│   │   ├── TimelineItem (OT_CREATED)
│   │   ├── TimelineItem (TELEMETRY_ALERT)
│   │   └── LoadMore button
│   └── TelemetrySnapshot
│       ├── ONUStatus
│       ├── SignalDBM
│       └── InfrastructuraIndicator
└── Sidebar (30%)
    ├── ClientCard
    ├── TechnicianCard
    ├── PriorityBadge
    ├── StatusSection
    ├── RecentEvents
    └── ActionButtons
        ├── RequestVisit Dialog
        └── CloseTicket Dialog
```

---

## Decisiones de Diseño Relacionadas

### 1. Mock Data vs Real API
**Decisión:** TicketDetailPage actualmente usa mock data, pero estructura permite fácil swap a API real.

```jsx
// Current (mock)
const ticket = MOCK_TICKET_DATA;

// Future (real)
const [ticket, setTicket] = useState(null);
useEffect(() => {
  fetch(`/api/v1/tickets/${id}`).then(setTicket);
}, [id]);
```

### 2. Real-time Updates
**Decisión:** Usar polling inicialmente, migrar a WebSocket después de MVP.

```javascript
// Phase 1: Polling (actuales)
setInterval(() => refetch(), 5000);

// Phase 2: WebSocket
ws.subscribe(`/tickets/${id}/updates`);
```

### 3. Responsabilidad de Refresh
**Decisión:** Dialogs cierran y TicketDetailPage se auto-actualiza (refetch automático).

```jsx
const handleVisitRequested = () => {
  closeDialog();
  refetchTimeline(); // Auto-update
}
```

---

## Estructura de BD Complementaria

Las decisiones de TicketDetailPage se basan en el esquema de BD v2.0:

| Tabla | Propósito | Acceso desde TicketDetailPage |
|-------|-----------|-------------------------------|
| **tickets_v2** | Datos base del ticket | Header + Info |
| **ticket_timeline** | Bitácora de eventos | Timeline section |
| **work_orders** | OTs asociadas | WorkOrderCard + Timeline |
| **work_order_items** | Materiales consumidos | WorkOrder detail (future) |

---

## Cambios Futuros Esperados

### Fase 2: Técnico Dashboard
Crear `TechnicianWorkOrderPage.jsx` con:
- Órdenes asignadas (pending → scheduled → in_progress)
- Detalles técnicos (equipo, configuración)
- Consumo de stock
- Firma digital de cliente

### Fase 3: App Móvil (Técnico)
- Versión mobile-first de TechnicianWorkOrderPage
- GPS/ubicación
- Fotos de diagnóstico
- Firma en tablet

### Fase 4: Reportes
- Reporte automático de OT
- KPIs operacionales (MTTR, resolución rate)
- Análisis de patrones

---

## Referencias

- [TicketDetailPage Implementation](../../frontend/src/pages/TicketDetailPage.jsx)
- [Database Schema v2.0](../BASE_DATOS.md#sistema-de-tickets-v20)
- [API Endpoints](../API_REFERENCE.md#tickets-v20)
- [Backend Architecture](../REPORTE_ARQ_BACKEND.md#sistema-de-tickets-v20)

---

**Fecha:** 02 de enero de 2026  
**Autor:** GitHub Copilot + Lucas (Team Emerald)  
**Rama:** feature/new-navigation
