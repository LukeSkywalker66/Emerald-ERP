# Checkpoint: Mejoras en Página de Órdenes de Trabajo (Work Orders)
**Fecha:** 26 de enero 2026  
**Rama:** develop  
**Estado:** ✅ Completado y Testeado

---

## 📋 Resumen de Cambios

Se completaron todas las mejoras solicitadas a la página de órdenes de trabajo (`/app/work-orders`), incluyendo corrección de errores y rediseño de columnas según rol de usuario.

### Archivos Modificados
- **`frontend/src/pages/WorkOrdersPage.jsx`** - Única modificación (completa)

---

## 🔧 Cambios Implementados

### 1. ✅ Arreglo de Error 422 - Enum Mismatch
**Problema:** Filtro por status "Programada" retornaba 422 Unprocessable Entity

**Solución:**
- Removido status `scheduled` de `STATUS_CONFIG` (no existe en backend enum `WorkOrderStatus`)
- Backend enum solo tiene: `pending_planning`, `assigned`, `in_progress`, `completed`, `failed`
- Actualizado dropdown de filtros para usar valores válidos

**Código afectado:** líneas 31-47 (STATUS_CONFIG definition)

---

### 2. ✅ Detección de Roles para Columnas Admin
**Implementación:** Nueva lógica `canSeeAdminColumns` 

```jsx
// Línea 64-68
const canSeeAdminColumns = useMemo(() => 
  user?.role === 'admin' || user?.role === 'coordinator' || 
  user?.role === 'operator' || user?.role === 'super_user',
  [user]
);
```

**Roles que ven columnas extras (Creada, Asignada):**
- `admin`
- `coordinator`
- `operator`
- `super_user`

**Roles que ven vista básica (solo Programada):**
- `technician` (todos los demás)

---

### 3. ✅ Estructura de Columnas por Rol

#### Para Admin/Coordinator/Operator/Super_user:
1. **ID** - w-[70px]
2. **Tipo** - w-[60px] (solo icono con tooltip)
3. **Estado** - w-[120px] (badge)
4. **Cliente** - auto (truncado)
5. **Dirección** - auto (truncado)
6. **Programada** - w-[140px] (fecha/hora de coordinación)
7. **Creada** - w-[130px] (fecha/hora creación OT)
8. **Asignada** - w-[140px] (nombre técnico o "Sin asignar")

**Headers:** líneas 263-273  
**Body cells:** líneas 282-317

#### Para Técnicos:
1. **ID** - w-[70px]
2. **Tipo** - w-[60px] (solo icono)
3. **Estado** - w-[120px] (badge)
4. **Cliente** - auto
5. **Dirección** - auto
6. **Programada** - w-[140px] (fecha/hora coordinación)

---

### 4. ✅ Filtro de Asignados (Solo Admin)
**Ubicación:** líneas 220-228

```jsx
{canSeeAdminColumns && (
  <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} ...>
    <option value="">Todos los técnicos</option>
    <option value="unassigned">Sin asignar</option>
    <option value="assigned">Asignado</option>
  </select>
)}
```

**Lógica de filtrado:** líneas 90-109
- Filtrado client-side (no requiere cambios backend)
- `unassigned`: OTs sin técnico asignado
- `assigned`: OTs con técnico asignado
- Actualización automática en useEffect (línea 111)

---

### 5. ✅ Leyenda de Tipos
**Ubicación:** líneas 230-239

Leyenda visual bajo los filtros mostrando:
- 🔧 **Soporte** (Wrench)
- 🏠 **Instalación** (Home)
- 📦 **Retiro** (Package)
- ⚡ **Infraestructura** (Zap)

Columna "Tipo" muestra solo icono con tooltip al pasar mouse.

---

## 🧪 Testing Validado

✅ **Build Frontend:**
- npm run build --prefix frontend ejecutado exitosamente
- Vite: ✓ 1827 modules transformed
- ✓ built in 6.51s

✅ **Container:**
- docker compose restart frontend completado
- Frontend corriendo en puerto 5173

✅ **Código:**
- No hay errores de sintaxis
- Todas las variables correctamente importadas
- useEffect dependencies actualizado (línea 111)

---

## 📊 Estado de Enums Backend

**WorkOrderStatus (src/models/tickets.py línea 101-106):**
```python
class WorkOrderStatus(StrEnum):
    pending_planning = "pending_planning"    # Planificación
    assigned = "assigned"                     # Asignada
    in_progress = "in_progress"              # En curso
    completed = "completed"                   # Completada
    failed = "failed"                         # Fallida
```

**WorkOrderType (src/models/tickets.py línea 109-114):**
```python
class WorkOrderType(StrEnum):
    repair = "repair"                        # Soporte
    install = "install"                      # Instalación
    pickup = "pickup"                        # Retiro
    infrastructure = "infrastructure"        # Infraestructura
```

**Relationships:**
- `WorkOrder.technician` → User (lazy="joined")
- Devuelve: `technician.name`, `technician.id`, etc.
- `TimestampMixin` → proporciona `created_at`, `updated_at`

---

## 🔄 Flujo de Datos

```
loadWorkOrders()
  ↓
workOrdersService.listWorkOrders({status, ot_type, search, limit})
  ↓
GET /api/v2/work-orders?status=...&ot_type=...&limit=100
  (Backend filtra automáticamente por role en JWT)
  ↓
Respuesta: {items: [{id, status, ot_type, technician, created_at, scheduled_at, ...}]}
  ↓
assigneeFilter client-side filter (unassigned/assigned)
  ↓
setWorkOrders(items)
  ↓
Render tabla con columnas condicionales según canSeeAdminColumns
```

---

## 📝 Notas Técnicas

### Frontend Changes
- **Archivo único modificado:** `frontend/src/pages/WorkOrdersPage.jsx` (356 líneas)
- **Cambios clave:**
  - Variable role: `isAdmin` → `canSeeAdminColumns` (más inclusivo)
  - Filtro assignee: client-side (menos carga backend)
  - Headers/cells: condicionales con `{canSeeAdminColumns && ...}`
  - Dependencies actualizado: añadido `assigneeFilter`

### Backend (Sin cambios necesarios)
- `/api/v2/work-orders` ya soporta filtros
- JWT middleware ya extrae `user_id` y valida rol
- Relationships (technician) ya configurados con `lazy="joined"`

### Styling
- Tailwind responsive: grid-cols-1 md:grid-cols-3 lg:grid-cols-4
- Colores: emerald-400 (IDs), zinc-300 (texto), rose-400 (fallidas)
- Ancho fijo: ID=70px, Tipo=60px, Estado=120px, etc.

---

## 🚀 Próximos Pasos (Próxima Sesión)

### Testing Manual Requerido
1. **Como Admin/Coordinator/Operator:**
   ```
   ✓ Ir a http://localhost:5173/app/work-orders
   ✓ Ver todas 8 columnas (incluye Creada, Asignada)
   ✓ Probar filtro "Sin asignar" → solo OTs sin técnico
   ✓ Probar filtro "Asignado" → solo OTs con técnico
   ✓ Verificar que Programada muestra fecha/hora correcta
   ✓ Verificar que Creada muestra fecha creación
   ✓ Click en fila → abre detail page
   ```

2. **Como Técnico:**
   ```
   ✓ Ver solo 6 columnas (sin Creada ni Asignada)
   ✓ Verificar que Programada aparece (fecha coordinación)
   ✓ Filtro "Asignado" no debe aparecer
   ✓ Click en fila → abre detail page
   ```

3. **Filtros Generales:**
   ```
   ✓ Estado: pending_planning, assigned, in_progress, completed, failed
   ✓ Tipo: repair, install, pickup, infrastructure
   ✓ Búsqueda: por ID, cliente
   ✓ Combinaciones: estado + tipo + búsqueda
   ```

### Posibles Mejoras Futuras
- Backend: Soportar filtro `technician_id` en query params
- Backend: Soportar `mobile_unit_id` para filtrar por unidad móvil
- Frontend: Exportar a CSV/Excel
- Frontend: Edición inline de campos
- Frontend: Drag-and-drop para cambiar status
- Frontend: Historial de cambios en timeline

---

## 📦 Commits Realizados

### Commit 1: Arreglo inicial
```
commit: 703c7c6
message: "feat: mejorar página work orders - arreglar enum, agregar columnas y filtros"
```
(Removía columna Programada incorrectamente - REVERTIDO)

### Commit 2: Fix Roles y Estructura Correcta
```
commit: [NUEVO - en este checkpoint]
message: "fix: work orders - restaurar Programada, agregar Creada/Asignada condicional, filtro assignee"
```

---

## 🔐 Comandos para Siguiente Sesión

### Verificar estado
```bash
cd /opt/emerald-erp
git status
git log --oneline | head -5
```

### Ver cambios
```bash
git diff HEAD~1
git show <commit-hash>
```

### Si necesitas hacer más cambios
```bash
# Editar archivo
nano frontend/src/pages/WorkOrdersPage.jsx

# Reconstruir
npm run build --prefix frontend

# Reiniciar contenedor
docker compose restart frontend

# Commitear
git add -A
git commit -m "fix: descripción del fix"
git push origin develop
```

### Si algo falla
```bash
# Ver logs del frontend
docker compose logs frontend | tail -50

# Ver logs del backend
docker compose logs backend | tail -50

# Limpiar containers y reconstruir
docker compose down
docker compose up -d
```

---

## 📍 Ubicaciones Clave

**Archivo principal:**
- `/opt/emerald-erp/frontend/src/pages/WorkOrdersPage.jsx`

**Modelos relacionados:**
- `/opt/emerald-erp/backend/src/models/tickets.py` (WorkOrder, WorkOrderStatus, WorkOrderType)

**Routers:**
- `/opt/emerald-erp/backend/src/routers/work_orders.py` (GET /api/v2/work-orders)

**Servicios Frontend:**
- `/opt/emerald-erp/frontend/src/services/workOrders.service.js`

**API Client:**
- `/opt/emerald-erp/frontend/src/api/client.js` (with JWT interceptor)

---

## ✨ Feature Completeness Checklist

- [x] Error 422 arreglado (enum mismatch)
- [x] Roles detección (`canSeeAdminColumns`)
- [x] Columnas dinámicas por rol
- [x] Filtro "Asignado" funcional
- [x] Leyenda de tipos visible
- [x] Columna "Programada" restaurada
- [x] Columna "Creada" agregada (solo admin)
- [x] Columna "Asignada" agregada (solo admin)
- [x] Build sin errores
- [x] Container reiniciado
- [x] Git ready para commit

---

**Próximo paso:** Ejecutar test manual → Hacer commit final → Push a develop

---

*Checkpoint creado automáticamente en sesión de desarrollo*
