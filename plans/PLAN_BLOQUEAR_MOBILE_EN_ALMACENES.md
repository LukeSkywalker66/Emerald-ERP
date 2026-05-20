# Plan: Bloquear creación de MOBILE warehouses desde el módulo Almacenes

## Estado Actual

### Backend — YA protegido
| Endpoint | ¿Permite MOBILE? |
|----------|:-:|
| `POST /api/v2/inventory/warehouses` | ❌ Bloqueado (FASE 6) — error 400 |
| `POST /api/v2/fleet` | ✅ Crea Vehicle + Warehouse MOBILE automáticamente |

### Frontend — AÚN expuesto
El formulario de crear/editar warehouse en WarehouseList.jsx todavía:
1. Muestra `MOBILE` como opción seleccionable en el `<select>` de tipo
2. Muestra campos condicionales (`user_id`) cuando se selecciona MOBILE
3. Tiene validación frontend que espera `user_id` para MOBILE

**Problema:** usuario selecciona MOBILE → backend rechaza con 400 → error confuso.

---

## Cambios Necesarios

### 1. Formulario de CREAR warehouse

**Archivo:** [`frontend/src/pages/inventory/WarehouseList.jsx`](frontend/src/pages/inventory/WarehouseList.jsx)

**Qué cambiar:**
- En el `<select>` del tipo (línea 531), remover la opción `MOBILE`
- Remover el bloque condicional `{formData.type === 'MOBILE' && ( ... )}` (líneas 538-553) que muestra el campo `user_id`
- Remover la validación frontend (líneas 114-116) que exige `user_id` para MOBILE

**Código actual (línea 531):**
```jsx
<option value="CENTRAL">CENTRAL - Depósito principal</option>
<option value="MOBILE">MOBILE - Camioneta de técnico</option>
<option value="VIRTUAL">VIRTUAL - Ubicación lógica</option>
```

**Código nuevo:**
```jsx
<option value="CENTRAL">CENTRAL - Depósito principal</option>
<option value="VIRTUAL">VIRTUAL - Ubicación lógica</option>
```

### 2. Formulario de EDITAR warehouse

**Archivo:** [`frontend/src/pages/inventory/WarehouseList.jsx`](frontend/src/pages/inventory/WarehouseList.jsx)

**Qué cambiar:**
- En el `<select>` del tipo (línea 643), remover la opción `MOBILE`
- Si el warehouse actual es MOBILE, **deshabilitar el selector** y mostrar mensaje: "El tipo MOBILE se gestiona desde el módulo Flota"
- Remover el bloque condicional `{formData.type === 'MOBILE' && ( ... )}` (líneas 649-664)

### 3. Mantener MOBILE visible SOLO en filtros y visualización

**No cambiar:**
- Filtro de tipo en la cabecera (línea 295) — MOBILE debe seguir siendo filtrable
- Badge de tipo MOBILE en las tarjetas (línea 231) — sigue siendo válido
- Card de warehouse MOBILE con info del vehículo (línea 405) — recién agregado, funciona bien
- Contador de móviles en el footer (línea 470) — útil para estadísticas

### 4. Opcional: Indicador visual en tarjetas MOBILE

Agregar un pequeño badge "Gestionado desde Flota" o similar en las tarjetas de tipo MOBILE para que el usuario entienda que no se edita desde Almacenes.

---

## Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `WarehouseList.jsx` | Remover opción MOBILE del selector de tipo (crear y editar) |
| `WarehouseList.jsx` | Remover campo `user_id` condicional (ya no aplica) |
| `WarehouseList.jsx` | Remover validación frontend de `user_id` para MOBILE |
| `WarehouseList.jsx` | Deshabilitar selector de tipo cuando el warehouse es MOBILE (edición) |
| `WarehouseList.jsx` | Opcional: badge "Gestionado desde Flota" en tarjetas MOBILE |

**No requiere cambios en backend** — ya está protegido desde FASE 6.
