# 📋 Handoff - Sesión 02 Junio 2026

**Branch:** `feature/auditoria-storage`
**Temas tratados:**
1. 🔧 Redirect a `/monitor/` en desarrollo (solucionado)
2. 📎 Archivos adjuntos (MinIO) - 404 al descargar (solucionado)
3. 🚦 OTs bloqueadas - Manejo visual y "No Realizada" (implementado, con issue pendiente)

---

## 1. 🔧 Redirect a `/monitor/` en desarrollo

### Problema
Al acceder a `https://emerald-dev.2finternet.ar/`, redirigía automáticamente a `/monitor/`.

### Causa
nginx cacheaba la resolución DNS del hostname `frontend`. Cuando el contenedor `emerald_frontend_dev` se reiniciaba, obtenía una nueva IP, pero nginx seguía usando la IP anterior.

### Fix aplicado
**Archivo:** [`nginx/default.conf`](nginx/default.conf)
- Línea 6: Agregado `resolver 127.0.0.11 valid=10s ipv6=off;`
- Esto fuerza a nginx a resolver DNS cada 10s usando el resolver de Docker
- El archivo es COMPARTIDO por los 3 entornos (dev, staging, prod)

### Comandos útiles
```bash
docker exec emerald_nginx_dev nginx -s reload
```

---

## 2. 📎 Archivos adjuntos (MinIO) - 404 al descargar

### Problema
Los archivos se subían a MinIO correctamente pero no se podían descargar (404). El frontend recibía URLs del tipo `http://minio:9000/emerald-attachments/...` (inaccesibles desde el navegador).

### Causa raíz
1. No existía endpoint GET público para servir archivos desde MinIO
2. La URL generada por `get_file_url()` apuntaba a `minio:9000` (red interna Docker)
3. Archivos legacy (anteriores a la migración MinIO) estaban en el filesystem con URLs `/media/tickets/...`
4. Había un endpoint duplicado en `tickets.py` que pisaba al nuevo de `tickets_v2_attachment.py`

### Fix aplicado

**Archivo:** [`backend/src/routers/tickets_v2_attachment.py`](backend/src/routers/tickets_v2_attachment.py)
- Línea 134: URL pública corregida a `/api/v2/tickets/{ticket_id}/attachments/{attachment_id}/file`
- Líneas 173-240: Nuevo endpoint GET con fallback:
  1. Intenta leer de MinIO (archivos nuevos)
  2. Si falla, intenta leer del filesystem (archivos legacy)
  3. Si no existe, devuelve 404

**Archivo:** [`backend/src/main.py`](backend/src/main.py)
- Líneas 247: Agregado `/media` al whitelist de auth
- Línea 250: Agregado patrón `/attachments/.../file` al whitelist
- Líneas 376-415: Nuevo endpoint `GET /media/{path}` para servir archivos legacy

**Archivo:** [`backend/src/routers/tickets.py`](backend/src/routers/tickets.py)
- Líneas 1177-1302: Eliminado endpoint duplicado `upload_ticket_attachment` (reemplazado por el de `tickets_v2_attachment.py`)

### Prueba
```bash
# Upload
curl -X POST https://emerald-dev.2finternet.ar/api/v2/tickets/98/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.png"

# Download (sin auth)
curl https://emerald-dev.2finternet.ar/api/v2/tickets/98/attachments/32/file

# Legacy filesystem
curl https://emerald-dev.2finternet.ar/media/tickets/96/98899696_WhatsApp_Image_2026-05-28_at_17.01.13.jpeg
```

---

## 3. 🚦 OTs bloqueadas - Manejo visual y "No Realizada"

### Problema
Las OTs con fecha programada en el pasado respondían con **423 Locked** al intentar iniciarlas, pero el frontend:
- No mostraba indicación visual de que la OT estaba vencida
- Solo mostraba un `alert()` genérico con el error
- No daba alternativas al usuario (completar o marcar como no realizada)

### Contexto del backend
El backend en [`work_orders.py:595-603`](backend/src/routers/work_orders.py:595) bloquea PATCH a OTs `completed`/`failed` (inmutables).  
En [`work_orders.py:619-634`](backend/src/routers/work_orders.py:619) permite el cambio a `completed`/`failed` incluso con fecha pasada.  
El endpoint `POST /work-orders/{id}/mark-incomplete` existe para el flujo de coordinación.

### Fix aplicado

**Archivo:** [`backend/src/models/tickets.py`](backend/src/models/tickets.py)
- Línea 161: Agregado `incomplete = "incomplete"` al enum `ResolutionCategory`

**Archivo:** [`frontend/src/components/work-orders/CloseWorkOrderDialog.jsx`](frontend/src/components/work-orders/CloseWorkOrderDialog.jsx)
- Líneas 333-338: Nueva categoría "No Realizada" en el wizard
- Líneas 332-339: Validación: si "No Realizada" → fotos opcionales
- Líneas 362-392: Payload dinámico: `status: 'failed'` si "No Realizada"
- Líneas 387-401: Error handling mejorado (soporta array de errores de FastAPI 422)

**Archivo:** [`frontend/src/pages/WorkOrderExecutionPage.jsx`](frontend/src/pages/WorkOrderExecutionPage.jsx)
- Líneas 483-489: Cálculo de `isExpired` (mismo grace period que backend: 5 min)
- Líneas 571-576: Badge 🔴 "Vencida"
- Líneas 578-612: [Iniciar] deshabilitado si vencida + [Cerrar OT] como alternativa
- Líneas 270-283: Manejo de error 423 con mensajes claros según `X-Locked-Reason`
- Eliminado `handleMarkIncomplete` (ahora integrado en wizard)

### ⚠️ Issue PENDIENTE: Coordinación no refresca

**Contexto:** Desde la vista de coordinación (`CoordinationSheet`), cuando se completa el wizard de cierre (incluyendo "No Realizada"), el modal se cierra correctamente pero la grilla de coordinación no se actualiza.

**Causa:** En [`CoordinationSheet.jsx:1112`](frontend/src/components/coordination/CoordinationSheet.jsx:1112):
```javascript
onComplete={() => {
  setShowCloseDialog(false);  // Cierra el dialog
  onClose();                   // CIERRA EL SHEET antes de refrescar ← PROBLEMA
  if (typeof onWorkOrderUpdated !== 'function') {
    console.error('❌ ...');
    return;
  }
  onWorkOrderUpdated();        // Nunca se ejecuta si onClose() desmonta el componente
}}
```

**Posible fix:** Invertir el orden: llamar a `onWorkOrderUpdated()` antes de `onClose()`:
```javascript
onComplete={async () => {
  setShowCloseDialog(false);
  if (typeof onWorkOrderUpdated === 'function') {
    await onWorkOrderUpdated();
  }
  onClose();
}}
```

**Nota:** Este archivo NO fue modificado en esta sesión. Es comportamiento pre-existente.

---

## Resumen de archivos modificados

| Archivo | Cambio | ¿Tocado? |
|---------|--------|----------|
| [`nginx/default.conf`](nginx/default.conf) | +resolver DNS | ✅ |
| [`backend/src/main.py`](backend/src/main.py) | +endpoint /media, whitelist | ✅ |
| [`backend/src/routers/tickets.py`](backend/src/routers/tickets.py) | -endpoint duplicado | ✅ |
| [`backend/src/routers/tickets_v2_attachment.py`](backend/src/routers/tickets_v2_attachment.py) | +GET endpoint, fix URL | ✅ |
| [`backend/src/models/tickets.py`](backend/src/models/tickets.py) | +incomplete enum | ✅ |
| [`frontend/src/components/work-orders/CloseWorkOrderDialog.jsx`](frontend/src/components/work-orders/CloseWorkOrderDialog.jsx) | +No Realizada, fix error | ✅ |
| [`frontend/src/pages/WorkOrderExecutionPage.jsx`](frontend/src/pages/WorkOrderExecutionPage.jsx) | +isExpired, badges, handlers | ✅ |
| [`frontend/src/components/coordination/CoordinationSheet.jsx`](frontend/src/components/coordination/CoordinationSheet.jsx) | **NO MODIFICADO** | ⛔ |

## Próximos pasos (pendientes)

1. **🔴 Fix CoordinationSheet refresh** - Invertir orden de `onComplete` en [`CoordinationSheet.jsx:1112`](frontend/src/components/coordination/CoordinationSheet.jsx:1112)
2. **🟡 MinIO** - Migrar archivos legacy del filesystem a MinIO (backfill)
3. **🟡 Cache de nginx + resolver** - Verificar que el fix del resolver no afecte rendimiento
4. **🟢 Tests E2E** - Agregar tests para el flujo de "No Realizada"
