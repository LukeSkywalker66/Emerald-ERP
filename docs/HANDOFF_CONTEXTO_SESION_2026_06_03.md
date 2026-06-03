# 📋 Handoff - Sesión 03 Junio 2026

**Branch:** `feature/auditoria-storage`
**Temas tratados:**
1. 🚦 Fix: Modal de cierre de OT desaparecía en CoordinationSheet (solucionado)
2. 🎯 Fix: Textarea no recibía foco en wizard de cierre (solucionado)
3. 📍 Fix: Modal "Actualizar Ubicación" no funcionaba desde CoordinationSheet (solucionado)
4. 🔄 Fix: PendingClosureAlert no se refrescaba al cerrar OT (solucionado)
5. 🧹 Limpieza de debug logs (ejecutado)

---

## 1. 🚦 Modal de cierre de OT desaparecía / textarea no recibía foco

### Problema
El [`CloseWorkOrderDialog`](frontend/src/components/work-orders/CloseWorkOrderDialog.jsx) se renderiza mediante `createPortal` a `document.body`. Desde el [`CoordinationSheet`](frontend/src/components/coordination/CoordinationSheet.jsx) (que es un `Sheet` de Radix UI), esto causaba dos problemas:
1. El modal se cerraba inmediatamente al hacer click (Radix detectaba "outside click" y cerraba el Sheet, desmontando el modal)
2. El `<textarea>` no recibía foco (Radix FocusScope detectaba la fuga de foco y lo devolvía al SheetContent)

### Causa raíz
Radix UI's `Sheet` usa un `DismissableLayer` + `FocusScope` internamente. Cuando un elemento fuera del `SheetContent` (como el portal del `Dialog`) recibe un `pointerdown` o `focusout`, Radix:
1. Llama a `onInteractOutside` / `onFocusOutside` → si no se previene, cierra el Sheet
2. El FocusScope devuelve el foco al SheetContent, impidiendo que inputs en el portal reciban foco

### Fix aplicado

**Archivo:** [`frontend/src/components/coordination/CoordinationSheet.jsx`](frontend/src/components/coordination/CoordinationSheet.jsx)

**A. Guards de Radix (no cerrar Sheet cuando hay modales hijos):**
- Líneas 450-456: `onInteractOutside` — previene cierre si `locationModalOpen` o `showCloseDialog`
- Líneas 457-464: `onFocusOutside` — previene refoco de Radix si `showCloseDialog` o `locationModalOpen`
- Líneas 466-472: `onEscapeKeyDown` — previene cierre con Escape si `showCloseDialog`

**B. Renderizar modales dentro del SheetContent con `portal={false}`:**
- Líneas 1047-1067: `CloseWorkOrderDialog` movido DENTRO de `SheetContent` con `portal={false}`
- Líneas 1070-1077: `UpdateLocationModal` agregado DENTRO de `SheetContent` con `portal={false}`

**Archivo:** [`frontend/src/components/ui/dialog.jsx`](frontend/src/components/ui/dialog.jsx)
- Línea 14: Nueva prop `portal` (default `true`)
- Líneas 79-108: Render condicional: con portal (`createPortal` a `z-[60]`) o in-situ (`fixed inset-0` a `z-[100]`)

**Archivo:** [`frontend/src/components/ui/UpdateLocationModal.jsx`](frontend/src/components/ui/UpdateLocationModal.jsx)
- Línea 31: Nueva prop `portal` (default `true`), se pasa a `Dialog`

**Archivo:** [`frontend/src/components/work-orders/CloseWorkOrderDialog.jsx`](frontend/src/components/work-orders/CloseWorkOrderDialog.jsx)
- Línea 22: Nueva prop `portal` (default `true`), se pasa a `Dialog`

---

## 2. 🔄 PendingClosureAlert no se refrescaba

### Problema
Al cerrar una OT desde CoordinationSheet, las estadísticas de OTs bloqueadas (PendingClosureAlert en el sidebar) no se actualizaban.

### Fix aplicado

**Archivo:** [`frontend/src/pages/coordination/CoordinationGridPage.jsx`](frontend/src/pages/coordination/CoordinationGridPage.jsx)
- Línea 42: Nuevo estado `pendingRefreshKey`
- Línea 212: `handleManualRefresh` ahora incrementa `pendingRefreshKey`
- Línea 288: Se pasa `pendingRefreshKey` a `CoordinationSidebar`

**Archivo:** [`frontend/src/components/coordination/CoordinationSidebar.jsx`](frontend/src/components/coordination/CoordinationSidebar.jsx)
- Línea 39: Nueva prop `pendingRefreshKey`
- Líneas 82-86: Nuevo `useEffect` que recarga `loadPendingClosureStats()` cuando `pendingRefreshKey` cambia

---

## 3. 📍 Modal "Actualizar Ubicación" no funcionaba

### Problema
Misma causa que el modal de cierre: el `UpdateLocationModal` usaba portal a `document.body`, y Radix FocusScope impedía el foco en su input.

### Fix
- Movido el `UpdateLocationModal` DENTRO del `SheetContent` con `portal={false}` (misma técnica que CloseWorkOrderDialog)
- Agregadas props `onCloseLocationModal` y `onLocationSaved` a `CoordinationSheet`
- Eliminado el `UpdateLocationModal` duplicado que estaba fuera del Sheet en `DraggableWorkOrderCard`

**Archivo:** [`frontend/src/components/coordination/DraggableWorkOrderCard.jsx`](frontend/src/components/coordination/DraggableWorkOrderCard.jsx)
- Líneas 353-357: Nuevos props `onCloseLocationModal` y `onLocationSaved`; eliminado `UpdateLocationModal` externo

---

## 4. 🧹 Limpieza

- Eliminado bloque `DEBUG` (console.log masivo) en [`CoordinationSheet.jsx:429`](frontend/src/components/coordination/CoordinationSheet.jsx:429)

---

## 5. Resumen de archivos modificados

| Archivo | Cambio | Líneas clave |
|---------|--------|-------------|
| [`frontend/src/components/ui/dialog.jsx`](frontend/src/components/ui/dialog.jsx) | +`portal` prop + render condicional | 14, 79-108 |
| [`frontend/src/components/ui/UpdateLocationModal.jsx`](frontend/src/components/ui/UpdateLocationModal.jsx) | +`portal` prop, se pasa a `Dialog` | 31, 90 |
| [`frontend/src/components/work-orders/CloseWorkOrderDialog.jsx`](frontend/src/components/work-orders/CloseWorkOrderDialog.jsx) | +`portal` prop, se pasa a `Dialog` | 22, 452 |
| [`frontend/src/components/coordination/CoordinationSheet.jsx`](frontend/src/components/coordination/CoordinationSheet.jsx) | Guards Radix + modales dentro de SheetContent + `onCloseLocationModal`/`onLocationSaved` | 450-472, 1047-1077 |
| [`frontend/src/components/coordination/DraggableWorkOrderCard.jsx`](frontend/src/components/coordination/DraggableWorkOrderCard.jsx) | Nuevos props, eliminado `UpdateLocationModal` externo | 347-363 |
| [`frontend/src/components/coordination/CoordinationSidebar.jsx`](frontend/src/components/coordination/CoordinationSidebar.jsx) | +`pendingRefreshKey` prop + `useEffect` de recarga | 39, 82-86 |
| [`frontend/src/pages/coordination/CoordinationGridPage.jsx`](frontend/src/pages/coordination/CoordinationGridPage.jsx) | +`pendingRefreshKey` state, se incrementa en refresh, se pasa al sidebar | 42, 212, 288 |

---

## 6. Próximos pasos (pendientes)

1. **🟡 MinIO** — Migrar archivos legacy del filesystem a MinIO (backfill)
2. **🟡 Cache de nginx + resolver** — Verificar que el fix del resolver no afecte rendimiento
3. **🟢 Tests E2E** — Agregar tests para el flujo de "No Realizada" y cierre desde coordinación
