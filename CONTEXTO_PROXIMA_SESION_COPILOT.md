# 🚀 Contexto para Próxima Sesión - Emerald ERP

**Fecha**: 23 de Enero 2026  
**Rama**: `develop`  
**Último Commit**: `03d74a2`  
**Estado**: Implementación en progreso, problema de autenticación pendiente

---

## 📌 ¿QUÉ SE HIZO HOY?

Se implementó **el sistema completo de categorías y motivos de tickets** junto con mejoras visuales en el timeline.

### ✅ Completado

#### Backend
1. **Tabla `ticket_reasons`** - Motivos específicos por categoría
2. **Endpoints** 
   - `GET /api/v2/tickets/categories`
   - `GET /api/v2/tickets/reasons?category_id=X`
3. **Timeline mejorado** - Ahora crea DOS eventos:
   - Evento 1: "Ticket creado" (tipo `status_change`)
   - Evento 2: Descripción con motivo como encabezado (tipo `note`)
4. **Schema `TicketResponse`** - Agregados campos:
   - `category_name: Optional[str]`
   - `reason_name: Optional[str]`
5. **Validación** - Tickets administrativos aceptan `ticket_reason_id`

#### Frontend
1. **TicketTimeline.jsx** - Nuevo método `formatContent()`:
   - Respeta saltos de línea (`\n`)
   - Primer línea como encabezado bold
   - Líneas adicionales en párrafos separados
   - Tarjetas con bordes mejorados
2. **TicketDetailPageNew.jsx** - Grid de metadatos:
   - Reorganizado en 3 filas × 2 columnas
   - Fila 1: Prioridad | Asignado a
   - Fila 2: **Categoría** (emerald) | **Motivo** (amber)
   - Fila 3: Creado por | Fecha

---

## 🔴 PROBLEMA IDENTIFICADO

### Usuario Creador Hardcodeado
- **Síntoma**: Todos los tickets muestran "Creado por: Administrador"
- **Causa**: El middleware JWT **no está pasando el `user_id` en `request.state`**
- **Ubicación**: `backend/src/routers/tickets.py` línea 122

```python
def get_user_id(request: Request) -> int:
    actual_user_id = getattr(request.state, "user_id", None)
    if not actual_user_id:
        # ⚠️ USA FALLBACK A user_id=2 (admin)
        return 2  # admin@emerald.com
    return actual_user_id
```

**Posibles causas:**
1. JWT middleware no está asignando `request.state.user_id` correctamente
2. El token del usuario no contiene el campo `sub` con el user_id
3. El middleware de auth está siendo skippeado en algún endpoint

---

## 🔧 CÓMO DEBUGGEAR

### Opción 1: Revisar JWT Middleware
**Archivo**: `backend/src/main.py` líneas 200-230

```python
# En el middleware, buscar:
if auth_header and auth_header.startswith("Bearer "):
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        request.state.user_id = payload.get("sub")  # ← AQUÍ debe estar
        request.state.auth_type = "jwt"
        return await call_next(request)
```

**Verificar**:
- ¿Se está asignando `request.state.user_id` correctamente?
- ¿El token contiene el campo `sub`?
- ¿El tipo del `sub` es integer o string?

### Opción 2: Ver el JWT del Usuario
1. Abrir DevTools (F12) en el navegador
2. Ir a `Application` → `Cookies` o `Local Storage`
3. Buscar la cookie/token de autenticación
4. Decodificar en https://jwt.io
5. Verificar que contiene `"sub": 3` (o el ID del usuario)

### Opción 3: Agregar Log Temporal
En `backend/src/routers/tickets.py`, línea 122:

```python
def get_user_id(request: Request) -> int:
    actual_user_id = getattr(request.state, "user_id", None)
    
    # DEBUG - Agregar un log cuando se usa el fallback
    if not actual_user_id:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.warning(f"⚠️ [TICKET CREATE] No hay user_id en request.state, usando admin (ID=2)")
        logger.warning(f"   Headers: {dict(request.headers)}")  # Mostrar headers
        logger.warning(f"   Auth type: {getattr(request.state, 'auth_type', 'NONE')}")
    
    return actual_user_id if actual_user_id else 2
```

Luego crear un ticket y revisar logs:
```bash
docker compose logs backend -f | grep -i "ticket create\|user_id"
```

---

## 📊 Estado del Sistema

### Tablas Creadas
✅ `ticket_categories` (5 categorías)  
✅ `ticket_reasons` (13 motivos)  
✅ `tickets` (con FK a categorías y motivos)  
✅ `ticket_timeline` (eventos de tickets)

### Endpoints Probados
✅ `POST /api/v2/tickets` - Crear administrativo con motivo  
✅ `GET /api/v2/tickets/{id}` - Obtener con categoría/motivo  
✅ `GET /api/v2/tickets/reasons?category_id=2` - Motivos por categoría

### UI Probada
✅ AdministrativeWizard crea tickets correctamente  
✅ Timeline muestra 2 eventos (pero con "Administrador" como autor)  
✅ Detalle muestra categoría y motivo  
⚠️ Autor siempre es "Administrador" (NO es el usuario actual)

---

## 🎯 Próximos Pasos (EN ORDEN)

### 1. **CRÍTICO**: Arreglar user_id
```
1. Revisar middleware JWT en main.py
2. Verificar que request.state.user_id se está asignando
3. Verificar que el token contiene "sub" con el user_id correcto
4. Test: Crear un ticket y confirmar que muestra el usuario correcto
```

### 2. **IMPORTANTE**: Test Completo del Timeline
```
1. Crear ticket administrativo
2. Verificar que aparezcan DOS eventos en timeline
3. Verificar que el segundo evento tiene el motivo como encabezado
4. Verificar formato (párrafos separados, no todo de corrido)
```

### 3. **IMPORTANTE**: Test de Otros Tipos
```
1. Crear ticket técnico (Sin Servicio)
2. Crear ticket de instalación
3. Crear ticket de traslado
4. Verificar que timeline funciona en todos los tipos
```

### 4. **OPCIONAL**: UI Polish
```
1. Si el timeline se ve feo, ajustar espaciado en TicketTimeline.jsx
2. Si las tarjetas se ven raras, revisar colores en TicketDetailPageNew.jsx
3. Confirmar que todo se ve bien en dark mode
```

---

## 📁 Archivos Clave Modificados

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `backend/src/routers/tickets.py` | Timeline DOS eventos, validación, user_id debug | 600-630, 122 |
| `backend/src/schemas/tickets.py` | Agregados category_name, reason_name | 243-263 |
| `backend/src/models/tickets.py` | Relaciones con TicketReason (existían) | N/A |
| `frontend/src/components/tickets/TicketTimeline.jsx` | Método formatContent(), tarjetas mejoradas | 213+ |
| `frontend/src/pages/TicketDetailPageNew.jsx` | Grid reorganizado con categoría/motivo | 290-333 |

---

## 🗄️ Base de Datos - Motivos

```
Falla Técnica (ID=1):
  - Sin Servicio (ID=6)
  - Intermitencia/Microcortes (ID=7)
  - Lentitud (ID=8)
  - Problema WiFi (ID=9)

Administrativo (ID=2):
  - Cambio de Plan/Servicio (ID=1)
  - Cambio de Titularidad (ID=2)
  - Facturación (ID=3)

Instalación (ID=3):
  - (sin motivos específicos en v1)

Traslado (ID=4):
  - Traslado Interno (ID=4)
  - Traslado a otro domicilio (ID=5)

Baja (ID=5):
  - Precio/Competencia (ID=10)
  - Disconformidad Técnica (ID=11)
  - Mudanza (ID=12)
  - Fallecimiento (ID=13)
```

---

## 🧪 Ticket de Prueba

**ID #70** (creado durante la sesión):
- Tipo: Administrativo
- Categoría: Administrativo (ID=2)
- Motivo: Cambio de Titularidad (ID=2)
- Descripción: "Esta es la descripción del ticket administrativo..."
- **Problema**: Muestra "Creado por: Administrador" en lugar del usuario actual

---

## 💾 Git

### Últimos Commits
```
03d74a2 - docs: Checkpoint completo - timeline de tickets y motivos
7ef9a48 - feat: Mejorar timeline de tickets y agregar categoría/motivo en detalle
```

### Para Actualizar
```bash
git pull origin develop
```

---

## 🚨 Checklist para la Próxima Sesión

- [ ] Revisar logs del backend al crear un ticket
- [ ] Verificar JWT middleware en `main.py`
- [ ] Confirmar que `request.state.user_id` se está pasando
- [ ] Decodificar JWT del navegador para ver `sub`
- [ ] Crear ticket de prueba y confirmar user_id correcto
- [ ] Verificar que timeline muestra 2 eventos separados
- [ ] Pruebas con otros tipos de tickets
- [ ] Confirmar que categoría/motivo aparecen en detalle

---

## 📞 Referencia Rápida

**Para debuggear user_id:**
```bash
# 1. Ver logs en tiempo real
docker compose logs backend -f | grep -i "user_id\|auth"

# 2. Crear un ticket desde curl
curl -X POST http://localhost:8500/api/v2/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket_type": "administrative", ...}'

# 3. Ver el ticket creado
curl http://localhost:8500/api/v2/tickets/70 | jq '.creator_name'
```

**Para ver el JWT:**
```javascript
// En console del navegador:
console.log(localStorage.getItem('token'))
// O revisar cookies:
document.cookie
```

---

## ℹ️ Información del Sistema

- **Backend**: FastAPI en puerto 8500
- **Frontend**: React + Vite en http://emerald.2finternet.ar
- **BD**: PostgreSQL en `db:5432/emerald_stock`
- **Auth**: JWT tokens en headers `Authorization: Bearer ...`
- **Hot-reload**: Activado en backend (cambios se aplican al guardar)

---

**Estado General**: 🟡 Funcional pero con bug de autenticación  
**Prioridad**: 🔴 Arreglar user_id PRIMERO  
**Tiempo estimado**: 30-45 minutos para debuggear y arreglar

