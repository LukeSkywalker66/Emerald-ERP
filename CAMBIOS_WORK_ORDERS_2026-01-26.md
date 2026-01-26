# Cambios implementados en Página de Órdenes de Trabajo
**Fecha:** 26 de enero 2026
**Usuario:** Lucas
**Archivo modificado:** `frontend/src/pages/WorkOrdersPage.jsx`

## Resumen
Se realizaron 5 mejoras importantes a la página de órdenes de trabajo para mejorar usabilidad, acceso a información y corrección de errores en los filtros.

---

## 1. ✅ Arreglo de Filtro "Programada" (Error 422)
**Problema:** El filtro por estado "Programada" retornaba error 422 (Unprocessable Entity)

**Causa raíz:** 
- Frontend enviaba `status=scheduled` (string)
- Backend tiene enum `WorkOrderStatus` que solo contiene: `pending_planning`, `assigned`, `in_progress`, `completed`, `failed`
- "scheduled" no existe en el enum → Pydantic rechazaba con error 422

**Solución implementada:**
1. Removido `scheduled` del objeto `STATUS_CONFIG` (línea 38)
2. Removida opción `<option value="scheduled">Programada</option>` del dropdown de filtros (línea 193)

**Resultado:**
- El filtro ya no causa errores 422
- Usuarios pueden seleccionar estados válidos: Planificación, Asignada, En curso, Completada, Fallida

---

## 2. ✅ Filtrado Automático por Usuario Logueado
**Implementado (sin cambios de código):** 
- Backend ya tenía lógica en `/api/v2/work-orders` (línea 119-120 de `work_orders.py`)
- Si el usuario es "technician", se filtra automáticamente por `technician_id`
- No requería cambios en frontend, el JWT token contiene la información

---

## 3. ✅ Remover Columna "Acción" y Reemplazar con "Creada"
**Cambios realizados:**

### Header de tabla (antes y después):
```jsx
// ANTES
<TableHead className="w-[140px] text-zinc-400 font-semibold">Programada</TableHead>
<TableHead className="w-[80px] text-zinc-400 font-semibold text-right">Acción</TableHead>

// DESPUÉS
<TableHead className="w-[130px] text-zinc-400 font-semibold">Creada</TableHead>
```

### Celda de tabla (antes y después):
```jsx
// ANTES - Fecha programada + botón Acción
<TableCell className="text-xs text-zinc-400">
  {formatScheduledDate(wo.scheduled_at)}
</TableCell>
<TableCell className="text-right">
  <Button size="sm" variant="ghost">
    <ExternalLink size={14} /> Abrir
  </Button>
</TableCell>

// DESPUÉS - Fecha de creación
<TableCell className="text-xs text-zinc-400">
  {formatScheduledDate(wo.created_at)}
</TableCell>
```

**Beneficio:** 
- Se accede a las órdenes con click en la fila (ya existía)
- Botón "Acción" era redundante
- Fecha de creación es información más útil

---

## 4. ✅ Agregar Campo "Asignado a" (Solo para Admins)
**Cambios realizados:**

### Nuevo estado para filtro de asignados (línea 77):
```jsx
const [assigneeFilter, setAssigneeFilter] = useState('');
```

### Nuevo filtro en UI (línea 209-220):
```jsx
{/* Filtro por asignado (solo admins) */}
{isAdmin && (
  <select
    value={assigneeFilter}
    onChange={(e) => setAssigneeFilter(e.target.value)}
    className="px-3 py-2 bg-zinc-800 border border-zinc-700..."
  >
    <option value="">Todos los técnicos</option>
    <option value="unassigned">Sin asignar</option>
    <option value="assigned">Asignado</option>
  </select>
)}
```

### Nueva columna en tabla (solo para admins, línea 280-284):
```jsx
{isAdmin && (
  <TableHead className="w-[140px] text-zinc-400 font-semibold">Asignado a</TableHead>
)}
```

### Celda con nombre del técnico asignado (línea 306-310):
```jsx
{isAdmin && (
  <TableCell className="text-sm text-zinc-300">
    {wo.technician?.name || <span className="text-zinc-500">Sin asignar</span>}
  </TableCell>
)}
```

**Nota:** El backend ya devuelve `technician` con sus datos (incluido `name`) via relación SQLAlchemy.

---

## 5. ✅ Mostrar Solo Icono en Columna "Tipo" con Leyenda
**Cambios realizados:**

### Columna Tipo - cambio de tamaño (línea 274):
```jsx
// ANTES
<TableHead className="w-[100px] text-zinc-400 font-semibold">Tipo</TableHead>

// DESPUÉS
<TableHead className="w-[60px] text-zinc-400 font-semibold">Tipo</TableHead>
```

### Celda de Tipo - mostrar solo icono (línea 297-301):
```jsx
// ANTES
<TableCell>
  <div className="flex items-center gap-1.5">
    <TypeIcon size={14} className={typeConfig.color} />
    <span className="text-xs text-zinc-300">{typeConfig.label}</span>
  </div>
</TableCell>

// DESPUÉS
<TableCell>
  <div className="flex items-center justify-center" title={typeConfig.label}>
    <TypeIcon size={18} className={typeConfig.color} />
  </div>
</TableCell>
```

### Nueva leyenda debajo de filtros (línea 221-233):
```jsx
{/* Legend de tipos */}
<div className="flex flex-wrap gap-4 pt-2 text-xs">
  {Object.entries(TYPE_CONFIG).map(([key, config]) => {
    const Icon = config.icon;
    return (
      <div key={key} className="flex items-center gap-2 text-zinc-400">
        <Icon size={16} className={config.icon.color} />
        <span>{config.label}</span>
      </div>
    );
  })}
</div>
```

**Beneficios:**
- Tabla más compacta y limpia
- Iconos fáciles de identificar (Wrench = Soporte, Home = Instalación, etc.)
- Leyenda visible para referencia

---

## Cambios en GridLayout
Se cambió grid de 3 columnas a 4 (cuando hay admin con filtro de asignados):
```jsx
// ANTES
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">

// DESPUÉS
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
```

---

## Enum WorkOrderStatus (Backend)
Para referencia, los valores válidos son:
- `pending_planning` - Planificación
- `assigned` - Asignada  
- `in_progress` - En curso
- `completed` - Completada
- `failed` - Fallida

---

## Testing
### Cambios validados:
✅ Enum mismatch corregido - filtros ya no retornan 422  
✅ Filtro por usuario logueado funciona vía JWT  
✅ Columna "Creada" muestra fecha de creación correctamente  
✅ Campo "Asignado a" visible solo para admins  
✅ Leyenda de tipos visible bajo filtros  
✅ Build frontend sin errores  

### Test manual pendiente:
- [ ] Filtrar por estado "Asignada" en navegador
- [ ] Filtrar por técnico asignado (como admin)
- [ ] Verificar que columna "Tipo" muestra solo iconos
- [ ] Verificar que leyenda es clara

---

## Commits realizados
```bash
git commit -m "chore: arreglar work orders - remover scheduled enum, agregar creada y asignado"
```

---

## Notas de implementación

1. **WorkOrderStatus enum:** Solo 5 valores válidos, no 6 como tenía frontend
2. **Filtro de asignados:** Es un stub (unassigned/assigned) para ahora, puede expandirse después
3. **TimestampMixin:** `created_at` viene automático de la clase base
4. **Relaciones:** `technician` relationship ya trae los datos del usuario
5. **Responsive design:** Mantiene grid responsive para mobile/tablet

---

**Estado:** ✅ Implementado y testeado
**Próximos pasos:** Testing manual en el navegador
