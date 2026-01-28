# CHECKPOINT 2026-01-27: Sistema RBAC y Filtros de Work Orders

**Fecha:** 27 de enero de 2026  
**Branch:** `develop`  
**Módulo:** Auth + Work Orders  
**Estado:** ✅ COMPLETADO Y VALIDADO

---

## 🎯 Objetivo

Corregir el sistema de autenticación y autorización para que los técnicos vean solo sus órdenes de trabajo asignadas, y los administradores vean todas las OTs con la columna "Asignada a" visible.

---

## 🐛 Problemas Identificados

### 1. Filtrado de Work Orders No Funcionaba
**Síntoma:** Usuario técnico "Pepe Peralta" veía todas las 43 OTs en lugar de solo las 2 asignadas a él.

**Causas Raíz:**
1. **Mismatch de nombre de rol:** El código verificaba `role_name == "technician"` pero la BD tiene `"tecnico"` (español)
2. **Función de auth local incorrecta:** El endpoint usaba `get_current_user()` local que no cargaba el rol del usuario correctamente
3. **Sin rol en JWT:** Los tokens JWT no incluían el campo `role`, imposibilitando verificaciones en frontend

### 2. Columna "Asignada" No Visible para Admins
**Síntoma:** La grilla de work orders no mostraba la columna "Asignada a" para usuarios admin/coordinator.

**Causa Raíz:**
- Frontend verificaba `user?.role` que era `undefined` porque el JWT no incluía el campo role
- `canSeeAdminColumns` siempre evaluaba a `false`

---

## ✅ Solución Implementada

### Backend: Autenticación y Filtrado

#### 1. Uso de Dependencia Global de Auth
**Archivo:** `backend/src/routers/work_orders.py`

**Cambios:**
- **Importado:** `from src.core.security import get_current_user`
- **Removido:** Funciones locales `get_user_id()` y `get_current_user()`
- **Actualizado:** Todas las firmas de funciones de `user_id: int = Depends(get_user_id)` a `current_user: User = Depends(get_current_user)`

**Código Clave (líneas 108-116):**
```python
# Normalizamos el rol para evitar accesos repetidos a relaciones
role_name = current_user.role.name if current_user.role else None

# Filtro automático por rol (nombre en español: "tecnico")
if role_name == "tecnico":
    base_query = base_query.filter(WorkOrder.technician_id == current_user.id)
# Admin/Coordinator u otros roles ven todas
```

**Beneficios:**
- ✅ Usa la dependencia correcta que carga relaciones de User
- ✅ Consistencia con el resto de la aplicación
- ✅ Mejor manejo de errores (401/403)

#### 2. Inclusión de Rol en JWT Tokens
**Archivos Modificados:**
- `backend/src/routers/v1/auth.py` (línea 188)
- `backend/src/services/auth_service.py` (línea 81)

**Cambio en auth_service.py:**
```python
access_token = create_access_token(
    data={
        "sub": str(user.id),
        "email": user.email,
        "username": user.username,
        "is_superuser": user.is_superuser,
        "role": user.role.name if user.role else None,  # ← AGREGADO
    },
    expires_delta=expires_delta,
    token_type="access",
)
```

**Estructura JWT Resultante:**
```json
{
  "sub": "16",
  "email": "pepe@example.com",
  "username": "pepe",
  "is_superuser": false,
  "role": "tecnico",
  "exp": 1738012345,
  "token_type": "access"
}
```

### Frontend: Extracción de Rol y UI Condicional

#### 1. Decodificación de Rol desde JWT
**Archivo:** `frontend/src/context/AuthContext.jsx` (línea 24)

```javascript
const decodeToken = (accessToken) => {
  try {
    const payload = accessToken.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return {
      id: parseInt(decoded.sub, 10),
      email: decoded.email,
      username: decoded.username,
      is_superuser: decoded.is_superuser,
      role: decoded.role,  // ← AGREGADO
      full_name: localStorage.getItem('emerald_full_name') || decoded.email,
    };
  } catch (err) {
    console.error('Error decodificando token:', err);
    return null;
  }
};
```

#### 2. Corrección de Referencia a Técnico
**Archivo:** `frontend/src/pages/WorkOrdersPage.jsx`

**Cambios:**
- **Línea 96-98:** Filtro de búsqueda usa `wo.technician_name` en lugar de `wo.technician`
- **Línea 343:** Display usa `wo.technician_name` directamente (ya viene del backend)

**Antes:**
```javascript
wo.technician?.name?.toLowerCase().includes(search.toLowerCase())
// ...
<TableCell>{wo.technician?.name}</TableCell>
```

**Después:**
```javascript
wo.technician_name?.toLowerCase().includes(search.toLowerCase())
// ...
<TableCell>{wo.technician_name}</TableCell>
```

**Razón:**
- El endpoint backend retorna `WorkOrderListResponse` que incluye `technician_name: str` (no un objeto technician)
- Evita referencias a objetos anidados que no existen en la respuesta

---

## 🧪 Validación y Testing

### Test 1: Filtrado por Rol Técnico
**Usuario:** Pepe Peralta (ID: 16, role: "tecnico")  
**OTs Asignadas:** #2 (de 43 totales)

**Comando:**
```bash
TOKEN=$(curl -X POST https://emerald.2finternet.ar/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pepe@example.com","password":"pepe123"}' | jq -r '.access_token')

curl -H "Authorization: Bearer $TOKEN" \
  https://emerald.2finternet.ar/api/v2/work-orders | jq '.total, [.items[].id]'
```

**Resultado:**
```json
1
[2]
```
✅ **PASS** - Pepe ve solo su OT asignada

### Test 2: JWT Incluye Rol
**Comando:**
```bash
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq '.role'
```

**Resultado:**
```json
"tecnico"
```
✅ **PASS** - Token incluye rol correctamente

### Test 3: Columna "Asignada" Visible
**Usuario:** Admin (después de logout/login con nuevo token)  
**Resultado:** Columna "Asignada a" visible en grilla de OTs  
✅ **PASS** - Confirmado por usuario

---

## 📊 Archivos Modificados

### Backend (3 archivos)
1. **`backend/src/routers/work_orders.py`**
   - Importa get_current_user global
   - Remueve funciones locales de auth
   - Cambia verificación de rol a "tecnico"
   - Actualiza todas las firmas de funciones

2. **`backend/src/routers/v1/auth.py`**
   - Agrega `"role": user.role.name` al JWT en refresh endpoint

3. **`backend/src/services/auth_service.py`**
   - Agrega `"role": user.role.name` al JWT en login

### Frontend (2 archivos)
1. **`frontend/src/context/AuthContext.jsx`**
   - Extrae `role` del JWT decodificado

2. **`frontend/src/pages/WorkOrdersPage.jsx`**
   - Usa `technician_name` en lugar de `technician?.name`
   - Filtro de búsqueda adaptado al campo correcto

### Documentación (1 archivo nuevo)
1. **`docs/RBAC_MEJORA_ROLES.md`**
   - Documenta sistema actual de roles hardcodeados
   - Propone arquitectura modular basada en permisos
   - Incluye plan de migración completo

---

## 🔧 Infraestructura

### Contenedores Reiniciados
- `emerald_backend` - Aplicar cambios en routers y servicios
- `emerald_frontend` - Aplicar cambios en AuthContext y páginas
- `emerald_nginx` - Resolver error de upstream "beholder"
- `emerald_beholder` - Iniciado (estaba detenido)

### Comandos Ejecutados
```bash
docker compose restart backend
docker compose restart frontend
docker compose up -d beholder
docker compose restart nginx
```

**Estado Final:** ✅ Todos los servicios operativos

---

## 🚨 Deuda Técnica Identificada

### Problemas Actuales

1. **Roles Hardcodeados como Strings**
   - ❌ Rol "tecnico" verificado con `if role_name == "tecnico"`
   - ❌ Frontend verifica `user?.role === 'admin' || user?.role === 'coordinator'...`
   - **Impacto:** Cada nuevo rol requiere modificar 4-6 archivos

2. **Sin Sistema de Permisos Granulares**
   - ❌ Autorización basada en rol completo, no en capacidades
   - **Ejemplo:** No se puede dar "ver todas OTs" a un rol sin darle también permisos de admin

3. **Lógica de Permisos Duplicada**
   - ❌ Backend verifica roles en endpoints
   - ❌ Frontend verifica roles en componentes
   - **Riesgo:** Inconsistencias entre frontend y backend

4. **Dependencia del Idioma**
   - ❌ Roles en español en BD ("tecnico", "operador")
   - **Impacto:** Difícil de internacionalizar

### Propuesta de Mejora

Ver documento completo en: **[docs/RBAC_MEJORA_ROLES.md](../RBAC_MEJORA_ROLES.md)**

**Resumen:**
- Implementar tabla `permissions` y `role_permissions`
- Sistema basado en capabilities: `work_orders.view_all`, `work_orders.assign`, etc.
- JWT incluye array de permisos en lugar de solo rol
- Frontend usa hook `usePermissions()` para verificar capacidades
- Backend usa decorador `@require_permission(Permission.WORK_ORDERS_VIEW_ALL)`

**Beneficios:**
- ✅ Agregar rol nuevo: 1 INSERT en BD, 0 cambios de código
- ✅ Cambiar permisos de rol: UPDATE en BD, sin redeploy
- ✅ Escalable a 50+ roles sin complejidad
- ✅ Testeable (mock permissions en JWT)

**Tiempo de Implementación:** 2-3 días dev + 1 semana validación

---

## 🎯 Decisión de Arquitectura

**Estado:** ⚠️ DECISIÓN PENDIENTE

**Opciones:**
1. **Mantener sistema actual** - Funcional para los 4-5 roles actuales, documentar como deuda técnica
2. **Migrar a sistema de permisos** - Inversión inicial, pero preparado para escalar

**Recomendación:** Migrar antes de agregar más de 2 roles nuevos o features con permisos granulares.

---

## 📝 Notas para Próxima Sesión

### Usuarios de Prueba
- **Admin:** root@example.com / root123
- **Técnico:** pepe@example.com / pepe123

### Roles en Base de Datos
```sql
SELECT id, name FROM roles;
-- 1 | admin
-- 5 | tecnico
-- 6 | viewer
-- 7 | operador
-- 8 | coordinator
```

### Re-login Requerido
⚠️ **IMPORTANTE:** Usuarios deben hacer logout/login después de estos cambios para obtener JWT con campo `role`.

### Comandos Útiles
```bash
# Ver logs de backend
docker compose logs -f backend --tail=100

# Reiniciar servicios
docker compose restart backend frontend

# Test de filtrado
bash test_wo_filtering.sh  # (archivo temporal creado durante sesión)
```

---

## ✅ Checklist de Validación

- [x] Técnicos ven solo sus OTs asignadas
- [x] Admins/Coordinators ven todas las OTs
- [x] Columna "Asignada a" visible para roles con permiso
- [x] JWT incluye campo `role`
- [x] Frontend extrae rol del token
- [x] Backend usa dependencia global get_current_user
- [x] Código sigue convenciones del proyecto
- [x] Tests manuales pasados
- [x] Documentación actualizada
- [x] Sin hardcodeos innecesarios (excepto strings de roles - deuda técnica documentada)

---

**Commit SHA:** [Pendiente]  
**Deploy:** Staging (https://emerald.2finternet.ar) - ✅ Validado  
**Próximo Deploy a Producción:** Pendiente aprobación de QA
