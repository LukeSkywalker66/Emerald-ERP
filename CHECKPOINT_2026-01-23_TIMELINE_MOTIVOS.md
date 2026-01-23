# CHECKPOINT - 23 de Enero 2026 - Timeline de Tickets y Motivos

**Commit:** `7ef9a48` - feat: Mejorar timeline de tickets y agregar categoría/motivo en detalle

## 📋 Resumen de la Sesión

Se implementó el sistema completo de **categorías y motivos de tickets** junto con mejoras visuales en el timeline y la página de detalle.

### ✅ Implementado

#### 1. **Backend - Sistema de Motivos**
- **Tabla `ticket_reasons`**: Motivos específicos por categoría (ej: "Cambio de Plan/Servicio", "Cambio de Titularidad", etc.)
- **Relaciones**: Cada motivo está vinculado a una categoría específica
- **Validación**: Backend rechaza motivos que no pertenecen a la categoría seleccionada (HTTP 400)
- **Archivo:** `backend/src/models/tickets.py` (modelo `TicketReason`)

#### 2. **Backend - Endpoints de Categorías/Motivos**
- `GET /api/v2/tickets/categories` → Lista todas las categorías
- `GET /api/v2/tickets/reasons?category_id=X` → Lista motivos de una categoría específica
- **Archivo:** `backend/src/routers/tickets.py` (líneas 45-79)

#### 3. **Backend - Timeline Mejorado**
- **Cambio importante**: Timeline ahora crea **DOS eventos separados** cuando se crea un ticket administrativo:
  1. Evento de **"Ticket creado"** (tipo `status_change`, ícono naranja)
  2. Evento de **descripción** (tipo `note`, con el motivo como encabezado)
- **Formato**: La descripción se muestra como `"{nombre_motivo}\n{descripción}"`
- **Archivo:** `backend/src/routers/tickets.py` (líneas 600-628)

#### 4. **Backend - Schema de Respuesta**
- `TicketResponse` ahora incluye:
  - `category_name: Optional[str]` (nombre de la categoría)
  - `reason_name: Optional[str]` (nombre del motivo)
- Helper `_ticket_to_response()` extrae estos valores de las relaciones SQLAlchemy
- **Archivo:** `backend/src/schemas/tickets.py` (líneas 243-263)

#### 5. **Frontend - Timeline Mejorado**
- Componente `TicketTimeline.jsx` ahora:
  - Respeta saltos de línea (`\n`) en el contenido
  - Primer línea como encabezado en **bold**
  - Líneas adicionales en párrafos separados con color suave
  - Tarjetas con bordes y mejor espaciado
- **Archivo:** `frontend/src/components/tickets/TicketTimeline.jsx` (línea 213 en adelante)

#### 6. **Frontend - Página de Detalle**
- Grid de metadatos reorganizado en 3 filas × 2 columnas:
  - Fila 1: **Prioridad** | **Asignado a**
  - Fila 2: **Categoría** (emerald-400) | **Motivo** (amber-400)
  - Fila 3: **Creado por** | **Fecha de creación**
- Los campos nuevos son **condicionales** (solo aparecen si existen)
- **Archivo:** `frontend/src/pages/TicketDetailPageNew.jsx` (líneas 290-333)

#### 7. **Backend - Validación de Tickets Administrativos**
- Ahora acepta **tanto** `administrative_subtype` (campo legacy del enum) **como** `ticket_reason_id` (nuevo sistema)
- Permite migración gradual del sistema antiguo al nuevo
- **Archivo:** `backend/src/routers/tickets.py` (líneas 500-507)

---

## 🗂️ Estructura de Datos

### Categorías de Tickets
```
1. Falla Técnica
2. Administrativo
3. Instalación
4. Traslado
5. Baja
```

### Motivos por Categoría (Ejemplo: Administrativo)
```
ID=1: Cambio de Plan/Servicio (category_id=2)
ID=2: Cambio de Titularidad (category_id=2)
ID=3: Facturación (category_id=2)
```

---

## 🔴 Problemas Identificados (Pendientes)

### 1. **Usuario Creador Hardcodeado**
- **Síntoma**: Todos los tickets creados muestran "Creado por: Administrador"
- **Causa**: El middleware de autenticación no está pasando correctamente el `user_id` en `request.state`
- **Código afectado**: `backend/src/routers/tickets.py` línea 122 (función `get_user_id()`)
- **Solución pendiente**: Revisar JWT middleware en `backend/src/main.py` líneas 200-230
- **Nota**: El fallback es hardcodeado a `user_id=2` (admin@emerald.com) cuando no hay JWT válido

### 2. **Test del Sistema Completo Pendiente**
- Crear tickets desde UI y verificar que aparezcan DOS eventos en timeline
- Verificar que el nombre del usuario actual sea correcto (no "Administrador")
- Probar con otros tipos de tickets (técnico, instalación, etc.)

---

## 📝 Instrucciones para Próxima Sesión

### Para Continuar Debuggeando

1. **Revisar autenticación:**
   ```bash
   # Ver los logs del backend mientras creas un ticket
   docker compose logs backend -f | grep -i "auth\|user_id"
   ```

2. **Inspeccionar el JWT:**
   - Abrir DevTools del navegador (F12)
   - Ir a Application → Cookies
   - Buscar la cookie de JWT o token en localStorage
   - Decodificar en jwt.io para ver si contiene el campo `sub` (user_id)

3. **Crear un ticket nuevo y verificar:**
   - Timeline debe tener DOS entradas
   - Primera: "Ticket creado" (naranja)
   - Segunda: "[Motivo seleccionado]" como título

### Para Arreglar el user_id

El problema probablemente está en una de estas ubicaciones:
- `backend/src/main.py` líneas 200-230 (middleware de JWT)
- El usuario logueado podría no tener el campo `user_id` en su JWT
- Revisar que el login correcto generó un token válido

---

## 🎯 Cambios de Código Clave

### backend/src/routers/tickets.py

**Antes:**
```python
timeline_content = f"Ticket creado - Tipo: {payload.ticket_type.value}"
if payload.description:
    timeline_content = f"{timeline_content}\n\n{payload.description}"

timeline_event = TicketTimeline(
    ticket_id=ticket.id,
    author_id=user_id,
    event_type=TicketTimelineEventType.note,
    content=timeline_content,
    meta_data={...}
)
```

**Después:**
```python
# DOS eventos separados
ticket_created_event = TicketTimeline(
    ticket_id=ticket.id,
    author_id=user_id,
    event_type=TicketTimelineEventType.status_change,
    content="Ticket creado",
    meta_data={...}
)

if payload.description and payload.description.strip():
    reason_header = "Descripción"
    if payload.ticket_reason_id:
        reason = db.get(TicketReason, payload.ticket_reason_id)
        if reason:
            reason_header = reason.name
    
    description_event = TicketTimeline(
        ticket_id=ticket.id,
        author_id=user_id,
        event_type=TicketTimelineEventType.note,
        content=f"{reason_header}\n{payload.description}",
        meta_data={"reason_id": payload.ticket_reason_id, "is_initial_description": True}
    )
```

### frontend/src/components/tickets/TicketTimeline.jsx

**Nuevo método para formatear contenido:**
```javascript
const formatContent = (content) => {
  if (!content) return '';
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 1) {
    return <span className="text-sm font-medium text-white">{lines[0]}</span>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-white">{lines[0]}</p>
      {lines.slice(1).map((line, idx) => (
        <p key={idx} className="text-sm text-zinc-300 leading-relaxed">{line}</p>
      ))}
    </div>
  );
};
```

---

## 🧪 Ticket de Prueba

- **ID**: #70 (creado durante la sesión)
- **Tipo**: Administrativo
- **Categoría**: Administrativo (ID=2)
- **Motivo**: Cambio de Titularidad (ID=2)
- **Descripción**: "Esta es la descripción del ticket administrativo que debe aparecer en la bitácora del timeline"
- **Estado esperado**: 
  - Timeline con 2 eventos
  - Categoría y Motivo visibles en detalle

---

## 📚 Base de Datos

### Motivos Creados
```sql
-- Categoría 1 (Falla Técnica)
INSERT INTO ticket_reasons (category_id, name) VALUES
  (1, 'Sin Servicio'),
  (1, 'Intermitencia/Microcortes'),
  (1, 'Lentitud'),
  (1, 'Problema WiFi');

-- Categoría 2 (Administrativo)
INSERT INTO ticket_reasons (category_id, name) VALUES
  (2, 'Cambio de Plan/Servicio'),
  (2, 'Cambio de Titularidad'),
  (2, 'Facturación');

-- Categoría 4 (Traslado)
INSERT INTO ticket_reasons (category_id, name) VALUES
  (4, 'Traslado Interno'),
  (4, 'Traslado a otro domicilio');

-- Categoría 5 (Baja)
INSERT INTO ticket_reasons (category_id, name) VALUES
  (5, 'Precio/Competencia'),
  (5, 'Disconformidad Técnica'),
  (5, 'Mudanza'),
  (5, 'Fallecimiento');
```

---

## 🔗 Git Commit

```
7ef9a48 - feat: Mejorar timeline de tickets y agregar categoría/motivo en detalle
```

**Archivos modificados:**
- `backend/src/routers/tickets.py` (+68, -25)
- `backend/src/schemas/tickets.py` (+15, -8)
- `frontend/src/components/tickets/TicketTimeline.jsx` (+35, -12)
- `frontend/src/pages/TicketDetailPageNew.jsx` (+28, -15)

---

## ⚠️ Notas Técnicas

1. **Hot-reload del Backend**: El archivo `backend/src/routers/tickets.py` se está recargando automáticamente cuando se edita, lo que puede causar reloads repetidos. Esto es normal.

2. **Lazy loading de relaciones**: Las relaciones `ticket.category` y `ticket.reason` usan `lazy="joined"` en el modelo, así se cargan automáticamente sin queries adicionales.

3. **Timeline event_type**: Se usan dos tipos:
   - `status_change` para "Ticket creado" (cambio de estado inicial)
   - `note` para la descripción (anotación)

4. **Formato de contenido**: El frontend ahora maneja contenido multiline correctamente, respetando `\n` como separadores.

---

**Estado General**: ✅ Backend funcionando | ⚠️ Autenticación pendiente | ✅ Frontend actualizado

