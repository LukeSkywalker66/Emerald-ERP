# Work Order Execution - Quick Start Guide for Developers

## 🎯 Overview

This guide helps you understand, test, and extend the Work Order Execution feature for field technicians.

**Route:** `/app/work-orders/:id/execute`  
**Status:** ✅ Complete and deployable  
**Last Updated:** 2026-01-06

---

## 🚀 Quick Start

### Backend Testing

**1. Start the backend:**
```bash
cd /opt/emerald-erp/backend
docker compose up -d backend postgres
docker compose logs -f backend
```

**2. Check migrations applied:**
```bash
docker compose exec backend alembic current
# Should show: b9b68ddfc7de_add_work_order_execution_fields
```

**3. Test endpoints:**
```bash
# Get work order details
curl -X GET http://localhost:8000/api/v2/work-orders/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Start work
curl -X PATCH http://localhost:8000/api/v2/work-orders/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"started_at": "2026-01-06T14:35:00Z"}'

# Add material
curl -X POST http://localhost:8000/api/v2/work-orders/1/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 123,
    "quantity": 1,
    "serial_number": "ABC123",
    "notes": "ONT Fiber"
  }'

# Complete work
curl -X PATCH http://localhost:8000/api/v2/work-orders/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completed_at": "2026-01-06T15:58:00Z",
    "resolution_type": "success",
    "resolution_notes": "Service restored. Speed test: 300 Mbps."
  }'
```

### Frontend Testing

**1. Start frontend dev server:**
```bash
cd /opt/emerald-erp/frontend
npm install  # if not done
npm run dev
```

**2. Navigate to:**
```
http://localhost:5173/app/work-orders/1/execute
```

**3. Manual test flow:**
- [ ] Page loads with WO details
- [ ] Timer visible but not counting
- [ ] Click "Iniciar Trabajo" → Timer starts
- [ ] Click "Ejecutar Diagnóstico" → Result appears after 1.5s
- [ ] Click "+Agregar Material" → Dialog opens
- [ ] Fill form and submit → Material appears in list
- [ ] Click trash icon → Material removed after confirmation
- [ ] Click "Completar Trabajo" → Resolution dialog
- [ ] Select type and add notes → Click submit
- [ ] Page shows completed state → Redirects to /app/tickets

---

## 📚 File Structure

```
backend/
├── src/
│   ├── models/
│   │   └── tickets.py          ← WorkOrder model (EXTENDED)
│   ├── schemas/
│   │   └── tickets.py          ← Schemas (NEW: 4 schemas)
│   ├── routers/
│   │   └── work_orders.py      ← Router (NEW: 4 endpoints)
│   └── main.py                 ← Router registration (MODIFIED)
│
└── alembic/
    └── versions/
        └── b9b68ddfc7de...py   ← Migration (NEW: APPLIED)

frontend/
├── src/
│   ├── pages/
│   │   └── WorkOrderExecutionPage.jsx    ← Main component (NEW)
│   ├── services/
│   │   └── workOrders.service.js         ← API client (NEW)
│   └── App.jsx                           ← Route registration (MODIFIED)
```

---

## 🔧 Understanding the Code

### Backend: Model Extension

**File:** `backend/src/models/tickets.py`

```python
class WorkOrderResolutionType(StrEnum):
    success = "success"
    failed = "failed"
    rescheduled = "rescheduled"
    partial = "partial"

class WorkOrder(Base):
    # ... existing fields ...
    
    # NEW FIELDS:
    started_at: Mapped[Optional[DateTime]]
    completed_at: Mapped[Optional[DateTime]]
    resolution_type: Mapped[Optional[WorkOrderResolutionType]]
    resolution_notes: Mapped[Optional[str]]
    custom_data: Mapped[Optional[dict]]  # JSONB for flexibility
```

**Why JSONB?** Different OT types need different diagnostic data:
- Repair: optical_signal_dbm, pppoe_status
- Install: onu_serial, ont_model
- Pickup: mac_recovered

### Backend: Routes

**File:** `backend/src/routers/work_orders.py`

```python
@router.get("/{work_order_id}", response_model=WorkOrderDetailResponse)
def get_work_order_detail(work_order_id: int, db: Session, user_id: int):
    """Get complete WO with items and ticket info."""
    
@router.patch("/{work_order_id}", response_model=WorkOrderDetailResponse)
def update_work_order(work_order_id: int, payload: WorkOrderUpdate, db: Session, user_id: int):
    """Update status/resolution. Creates timeline events."""
    
@router.post("/{work_order_id}/items", response_model=WorkOrderItemResponse)
def add_work_order_item(work_order_id: int, payload: WorkOrderItemCreate, db: Session, user_id: int):
    """Add consumed material. Creates timeline event."""
    
@router.delete("/{work_order_id}/items/{item_id}")
def remove_work_order_item(work_order_id: int, item_id: int, db: Session, user_id: int):
    """Remove material item. Creates timeline event."""
```

### Frontend: Main Component

**File:** `frontend/src/pages/WorkOrderExecutionPage.jsx`

Key components inside:
```javascript
// Timer: Shows elapsed time HH:MM:SS
function Timer({ startedAt }) { ... }

// Diagnostic: Shows PPPoE status, signal strength, uptime
function DiagnosticResult({ result, loading, error }) { ... }

// Material item with delete button
function MaterialItem({ item, onRemove, loading }) { ... }

// Main page with all state management
export default function WorkOrderExecutionPage() { ... }
```

### Frontend: Service Layer

**File:** `frontend/src/services/workOrders.service.js`

```javascript
// All functions return promises
getWorkOrderDetail(workOrderId)              // GET
updateWorkOrder(workOrderId, payload)        // PATCH
addWorkOrderItem(workOrderId, payload)       // POST
removeWorkOrderItem(workOrderId, itemId)     // DELETE
runQuickDiagnostic(connectionId)             // MOCK (for Beholder)
```

---

## 🔄 Data Flow Diagram

```
Frontend Page Load
       │
       ├─→ getWorkOrderDetail(42)
       │        │
       │        └─→ GET /api/v2/work-orders/42
       │              │
       │              ├─ Query: workOrder + items + ticket
       │              │
       │              └─→ WorkOrderDetailResponse
       │                   {
       │                     id, status, started_at, ...,
       │                     items: [ { id, quantity, serial_number } ],
       │                     ticket_info: { ... }
       │                   }
       │
       └─→ State: { workOrder, loading: false }

User Clicks "Iniciar Trabajo"
       │
       ├─→ updateWorkOrder(42, { started_at: now })
       │        │
       │        └─→ PATCH /api/v2/work-orders/42
       │              │
       │              ├─ Update DB: started_at = now
       │              │
       │              ├─ Create TicketTimeline event
       │              │
       │              └─→ Updated WorkOrderDetailResponse
       │
       └─→ State: { workOrder, started_at ≠ null }
           Timer Component: useEffect monitors started_at, updates every 1s

User Clicks "+Agregar Material"
       │
       ├─→ Dialog opens: MaterialForm
       │
       └─→ onSubmit: addWorkOrderItem(42, { product_id, quantity, ... })
               │
               └─→ POST /api/v2/work-orders/42/items
                     │
                     ├─ Insert: WorkOrderItem
                     │
                     ├─ Create TicketTimeline event
                     │
                     └─→ WorkOrderItemResponse
                        
           State: { items: [..., newItem] }

User Clicks "Completar Trabajo"
       │
       ├─→ ResolutionDialog opens
       │
       └─→ onSubmit: updateWorkOrder(42, { completed_at, resolution_type, ... })
               │
               └─→ PATCH /api/v2/work-orders/42
                     │
                     ├─ Update DB: completed_at, resolution_type
                     │
                     ├─ Create TicketTimeline event (final)
                     │
                     └─→ Updated WorkOrderDetailResponse
                        
           State: { workOrder.completed_at ≠ null }
           Visual: ✓ Completed badge
           Action: navigate('/app/tickets') after 2s
```

---

## 🧪 Testing Scenarios

### Test 1: Happy Path
```
1. Load WO (status: pending_planning)
2. Start → started_at set, timer begins
3. Run diagnostic → mock result displays
4. Add 2 materials → both in list
5. Complete → resolution_type = "success"
6. Verify: 4 timeline events created
```

**Expected DB State:**
- work_orders.started_at ≠ null
- work_orders.completed_at ≠ null
- work_orders.resolution_type = "success"
- work_orders.custom_data (if diagnostic stored)
- work_order_items.count = 2
- ticket_timeline.events.count = 4

### Test 2: Error Handling
```
1. Load WO
2. Try to add material without product_id
3. Expected: client-side validation error
4. Try to start WO twice
5. Expected: success (idempotent PATCH)
```

### Test 3: Material Management
```
1. Load WO with existing items
2. Delete item → item removed locally
3. Refresh page → item still gone (persisted)
4. Add same material twice → both visible
```

### Test 4: Timeline Events
```
1. Complete WO with all actions
2. Go to TicketDetailPage (ticket #X)
3. Scroll to timeline
4. Verify events in reverse chronological order:
   - "Técnico: Completó trabajo (Exitosa)"
   - "Técnico: Agregó material: ABC123"
   - "Técnico: Inició trabajo"
```

---

## 🔌 Integration with Beholder

**Current Status:** Mock implementation

**File:** `frontend/src/services/workOrders.service.js`

```javascript
export const runQuickDiagnostic = async (connectionId) => {
  // TODO: Replace with real Beholder API call
  // GET /api/v1/diagnose/{connection_id}
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockResult = {
        pppoe_status: Math.random() > 0.3 ? 'online' : 'offline',
        optical_signal_dbm: (-15 + Math.random() * 10).toFixed(2),
        uptime_hours: Math.floor(Math.random() * 48),
        last_check: new Date().toISOString(),
      };
      resolve(mockResult);
    }, 1500);
  });
};
```

**To integrate with real Beholder:**

1. **Replace mock with real API:**
```javascript
export const runQuickDiagnostic = async (connectionId) => {
  const { data } = await api.get(`/v1/diagnose/${connectionId}`);
  return data;  // { pppoe_status, optical_signal_dbm, uptime_hours, ... }
};
```

2. **Store in custom_data:**
```python
# backend/src/routers/work_orders.py
payload = {
    "custom_data": diagnostic_result  # JSONB storage
}
updateWorkOrder(..., payload)
```

3. **Display in component:**
```javascript
// Already implemented in DiagnosticResult component
<DiagnosticResult result={diagnosticResult} loading={...} error={...} />
```

---

## 📱 Responsive Design Notes

- **Mobile (<480px):** Full width, sticky header/footer
- **Tablet (480-768px):** h-14 buttons, max-width containers
- **Desktop (>768px):** Centered card layout, max-width 600px

**Touch targets:** All buttons min 56px (h-14) for iOS guidelines

---

## 🐛 Common Issues & Fixes

### Issue: Timer not updating
**Cause:** `startedAt` is null or not ISO format
**Fix:** Ensure `started_at` field is set via PATCH before timer starts

### Issue: Materials not persisting
**Cause:** Optimistic UI update, but POST failed silently
**Fix:** Check console for fetch errors, verify JWT token valid

### Issue: Redirect not working after complete
**Cause:** `navigate()` called before state updated
**Fix:** Already fixed with `setTimeout()` in component

### Issue: JSONB custom_data not storing
**Cause:** Field type not matching Python dict
**Fix:** Ensure payload passed to `updateWorkOrder()` has `custom_data: {...}`

---

## 📚 Related Files & Documentation

- **Implementation Details:** [WORK_ORDER_EXECUTION_IMPLEMENTATION.md](WORK_ORDER_EXECUTION_IMPLEMENTATION.md)
- **UI Mockups & Layout:** [WORK_ORDER_EXECUTION_UI_MOCKUP.md](WORK_ORDER_EXECUTION_UI_MOCKUP.md)
- **API Reference:** [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- **Database Schema:** [docs/BASE_DATOS.md](docs/BASE_DATOS.md)

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Beholder integration tested (not mock)
- [ ] Photo upload implemented (if required)
- [ ] Material stock validation working
- [ ] All 4 timeline event types tested
- [ ] JWT token expiration handled gracefully
- [ ] Mobile UI tested on actual device
- [ ] Error messages clear and actionable
- [ ] Performance: initial load <500ms, diagnostics <2s
- [ ] Analytics tracking installed (optional)
- [ ] Rollback plan documented

---

## 💡 Tips & Tricks

### Debug Timer Issues
```javascript
// In browser console
console.log(new Date(workOrder.started_at))  // Check ISO format
console.log(Date.now() - new Date(workOrder.started_at))  // Check diff
```

### Inspect JSONB Data
```sql
-- PostgreSQL
SELECT id, custom_data FROM work_orders WHERE id = 42;
-- custom_data can contain: { "optical_signal_dbm": "-18.5", "uptime_hours": 24, ... }
```

### Test Offline Mode (Future)
```javascript
// Frontend: Simulate offline
navigator.onLine = false;  // in DevTools console
// Material add should queue in localStorage
```

---

## 📞 Support

For issues or questions:
1. Check the implementation docs
2. Review the code comments
3. Check the test scenarios above
4. Consult the Emerald ERP team

---

**Happy coding! 🚀**

