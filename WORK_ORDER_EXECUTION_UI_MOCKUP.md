# Work Order Execution UI - Mockup Reference

## Mobile Layout (375px width)

```
┌─────────────────────────────────┐
│ ← │  Orden #42           │   ║ │  <- Sticky Header
│    │ Ticket #5            │     │
│    │ ───────────────────  │     │
│    │ 01:23:45  [repair]   │     │
└────┴──────────────────────┴─────┘

┌─────────────────────────────────┐
│ CLIENTE                          │
│                                 │
│ John Doe                        │
│ Av. Corrientes 1234, CABA      │
│ +54 9 1234-5678                │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Técnico: Juan Martinez          │
│ Programada: 06/01/2026          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ⚡ DIAGNÓSTICO            [NEW] │
│ ───────────────────────────────  │
│                                 │
│ ┌─────────────┬─────────────┐  │
│ │ PPPoE       │ Señal       │  │
│ │             │             │  │
│ │ ● Online    │ ⚡ -18.5 dBm│  │
│ └─────────────┴─────────────┘  │
│                                 │
│ ┌──────────────────────────────┐│
│ │ Uptime: 24h                  ││
│ └──────────────────────────────┘│
│                                 │
│ Última: 14:35:22                │
│                                 │
│  [⚡ EJECUTAR DIAGNÓSTICO]     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 📦 MATERIALES CONSUMIDOS        │
│ ───────────────────────────────  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ SN: ABC123456               │ │  Qty: 1
│ │ Notas: ONT Fibra            │ │  [🗑️]
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ SN: CABLE-001               │ │  Qty: 2
│ │ Notas: Cable FO 15m         │ │  [🗑️]
│ └─────────────────────────────┘ │
│                                 │
│  [+ AGREGAR MATERIAL]           │
└─────────────────────────────────┘

                                  ← Scrollable area
                                     Reaches bottom here

┌─────────────────────────────────┐
│  [✓ COMPLETAR TRABAJO]          │  <- Sticky Bottom
│  (en verde/gold)                │
└─────────────────────────────────┘
```

---

## Dialog: Agregar Material

```
┌──────────────────────────────────┐
│ ✕ Agregar Material              │
├──────────────────────────────────┤
│                                  │
│ PRODUCTO ID                      │
│ ┌────────────────────────────┐   │
│ │ 123               [Search] │   │
│ └────────────────────────────┘   │
│                                  │
│ CANTIDAD                         │
│ ┌────────────────────────────┐   │
│ │ 1                          │   │
│ └────────────────────────────┘   │
│                                  │
│ SERIAL NUMBER (opcional)         │
│ ┌────────────────────────────┐   │
│ │ SN: ABC123456              │   │
│ └────────────────────────────┘   │
│                                  │
│ NOTAS (opcional)                 │
│ ┌────────────────────────────┐   │
│ │ ONT Fibra, condición OK    │   │
│ │ (255 caracteres max)       │   │
│ └────────────────────────────┘   │
│                                  │
├──────────────────────────────────┤
│ [Cancelar]  [✓ Agregar]         │
└──────────────────────────────────┘
```

---

## Dialog: Completar Trabajo

```
┌──────────────────────────────────┐
│ ✕ Resolver Trabajo              │
├──────────────────────────────────┤
│                                  │
│ TIPO DE RESOLUCIÓN               │
│ ┌────────────────────────────┐   │
│ │ ✓ Exitosa               ▼ │   │
│ │   ✗ Fallida                │   │
│ │   ⊗ Parcial                │   │
│ │   ↻ Reprogramada           │   │
│ └────────────────────────────┘   │
│                                  │
│ NOTAS (opcional)                 │
│ ┌────────────────────────────┐   │
│ │ Se restauró servicio OK.   │   │
│ │ Cliente satisfecho. Prueba │   │
│ │ de velocidad: 300 Mbps.    │   │
│ │ (500 caracteres max)       │   │
│ │                            │   │
│ │           125/500          │   │
│ └────────────────────────────┘   │
│                                  │
├──────────────────────────────────┤
│ [Cancelar]  [✓ Completar]       │
└──────────────────────────────────┘
```

---

## Estados Visuales

### Estado: Pendiente (antes de iniciar)
```
Orden #42 [repair]
────────────────────
⏱️ Pendiente

[▶ INICIAR TRABAJO]  <- h-14 (56px)
```

### Estado: En Progreso (timer corriendo)
```
Orden #42 [repair]
────────────────────
⏱️ 01:23:45

[Material list]
[+Agregar Material]

[✓ COMPLETAR TRABAJO]  <- h-14
```

### Estado: Completada
```
Orden #42 [repair]
────────────────────
✓ Trabajo completado

┌──────────────────────┐
│ ✓ Exitosa            │
│ Notas: Se restauró   │
│        servicio OK   │
└──────────────────────┘

(todos los botones disabled)
```

---

## Color Scheme (Emerald Dark Mode)

```
Component              | Tailwind Class
───────────────────────┼──────────────────────
Background primary     | bg-zinc-950
Background secondary   | bg-zinc-900/50
Border                 | border-zinc-800
Text primary          | text-white
Text secondary        | text-zinc-300
Text tertiary         | text-zinc-400
Text muted            | text-zinc-500

Button: Iniciar/Run   | bg-emerald-600 hover:bg-emerald-700
Button: Completar     | bg-gold-600 hover:bg-gold-700
Button: Cancel        | bg-zinc-800 hover:bg-zinc-700
Button: Delete        | text-ruby-400 (on hover)

Status: Online        | text-emerald-400 + dot-emerald-400
Status: Offline       | text-ruby-400 + dot-ruby-400
Status: Warning       | text-gold-400
Status: Error         | border-ruby-800/50 bg-ruby-900/20
```

---

## Responsive Behavior

### Desktop (≥768px)
- Sidebar navigation visible (if within DashboardLayout)
- Work order card: max-width 600px, centered
- Dialogs: width 90%, max 500px

### Tablet (480-767px)
- Horizontal padding: 16px (px-4)
- Full-width except padding
- Large touch targets: 56px minimum

### Mobile (<480px)
- Full viewport width
- Horizontal padding: 16px
- Touch targets: 56-64px (h-14, h-16)
- Sticky header/footer for always-visible actions

---

## API Request Sequence

### Load Page
```
GET /api/v2/work-orders/42
│
├─ Includes: items[], technician, ticket, ticket_info
│
└─ Response: WorkOrderDetailResponse
   ├─ id, status, ot_type
   ├─ started_at, completed_at, resolution_type
   ├─ items: [{ id, product_id, quantity, serial_number, notes }]
   └─ ticket_info: { id, subject, connection_id, priority, client_name, ... }
```

### Start Work
```
PATCH /api/v2/work-orders/42
Body: { "started_at": "2026-01-06T14:35:00Z" }
│
├─ Creates TicketTimeline event: STATUS_CHANGE
│
└─ Response: Updated WorkOrderDetailResponse
   └─ started_at now set → Timer begins
```

### Run Diagnostic
```
// Mock for now - TO INTEGRATE WITH BEHOLDER
runQuickDiagnostic(connection_id)
│
└─ Returns:
   {
     "pppoe_status": "online",
     "optical_signal_dbm": "-18.5",
     "uptime_hours": 24,
     "last_check": "2026-01-06T14:35:22Z"
   }
```

### Add Material
```
POST /api/v2/work-orders/42/items
Body: {
  "product_id": 123,
  "quantity": 1,
  "serial_number": "ABC123456",
  "notes": "ONT Fibra"
}
│
├─ Creates TicketTimeline event: OT_EVENT ("Added material: ABC123456")
│
└─ Response: WorkOrderItemResponse
   └─ Item added, displayed in list
```

### Complete Work
```
PATCH /api/v2/work-orders/42
Body: {
  "completed_at": "2026-01-06T15:58:00Z",
  "resolution_type": "success",
  "resolution_notes": "Se restauró servicio. Prueba OK."
}
│
├─ Creates TicketTimeline event: OT_EVENT (completion summary)
│
├─ Response: Updated WorkOrderDetailResponse
│  └─ Status: completed, shows resolution badge
│
└─ Redirect: /app/tickets (after 2s)
```

---

## Accessibility Features

- ✅ ARIA labels on buttons (via Shadcn)
- ✅ Keyboard navigation (Tab, Enter)
- ✅ Focus rings on interactive elements
- ✅ High contrast text (zinc-100 on zinc-950)
- ✅ Icon + text labels (not icons alone)
- ✅ Form validation feedback

---

## Performance Targets

- Initial load (GET detail): <500ms
- Diagnostic run (mock): 1.5s
- Add material (POST): <300ms
- Dialog open: <100ms
- Timer update: 1000ms interval (no jank)

