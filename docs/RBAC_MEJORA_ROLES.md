# Sistema de Roles y Permisos - Estado Actual vs. Mejora Modular

**Fecha:** 27 de enero de 2026  
**Módulo:** Work Orders + Auth  
**Objetivo:** Documentar el funcionamiento actual del sistema RBAC y proponer mejora modular

---

## 📋 Estado Actual: Sistema Basado en Roles Hardcodeados

### Arquitectura Actual

```
┌─────────────┐
│  PostgreSQL │ ─── roles (id, name)
└─────────────┘      └── "admin", "tecnico", "coordinator"
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Backend: Generación de JWT                              │
│ ├─ auth_service.py: create_access_token()              │
│ │   └─ Token: { role: "tecnico", username: "..." }    │
│ └─ work_orders.py: Filtrado por rol                    │
│     └─ if role_name == "tecnico": filter(...)          │
└─────────────────────────────────────────────────────────┘
       │
       ▼ (JWT con rol)
       │
┌─────────────────────────────────────────────────────────┐
│ Frontend: Verificación de roles                         │
│ ├─ AuthContext.jsx: Extrae role del token              │
│ └─ WorkOrdersPage.jsx:                                 │
│     └─ canSeeAdminColumns = role === 'admin' ||        │
│                             role === 'coordinator'...   │
└─────────────────────────────────────────────────────────┘
```

### Flujo de Autenticación y Autorización

**1. Login del Usuario**
```python
# backend/src/services/auth_service.py:75-82
access_token = create_access_token(
    data={
        "sub": str(user.id),
        "email": user.email,
        "username": user.username,
        "is_superuser": user.is_superuser,
        "role": user.role.name if user.role else None,  # ← Nombre del rol
    },
)
```

**2. Frontend decodifica el token**
```javascript
// frontend/src/context/AuthContext.jsx:18-24
const decoded = JSON.parse(atob(payload));
return {
  id: parseInt(decoded.sub, 10),
  role: decoded.role,  // ← "admin", "tecnico", etc.
  // ...
};
```

**3. Backend filtra datos según rol**
```python
# backend/src/routers/work_orders.py:112-114
role_name = current_user.role.name if current_user.role else None

if role_name == "tecnico":  # ← String mágico hardcodeado
    base_query = base_query.filter(WorkOrder.technician_id == current_user.id)
```

**4. Frontend muestra/oculta UI según rol**
```javascript
// frontend/src/pages/WorkOrdersPage.jsx:65-67
const canSeeAdminColumns = useMemo(() => 
  user?.role === 'admin' || user?.role === 'coordinator' || 
  user?.role === 'operator' || user?.role === 'super_user',
  [user]
);
```

---

## 🔧 Caso de Uso: Agregar Nuevo Rol "Supervisor"

### Escenario
Querés agregar un nuevo rol `supervisor` que:
- Puede ver todas las OTs (como admin)
- Puede asignar técnicos
- NO puede eliminar OTs

### ❌ Implementación Actual (Hardcoded)

**Paso 1: Agregar rol en base de datos**
```sql
INSERT INTO roles (name) VALUES ('supervisor');
```

**Paso 2: Modificar backend - Filtrado de OTs**
```python
# backend/src/routers/work_orders.py
# ANTES:
if role_name == "tecnico":
    base_query = base_query.filter(WorkOrder.technician_id == current_user.id)

# DESPUÉS:
if role_name == "tecnico":
    base_query = base_query.filter(WorkOrder.technician_id == current_user.id)
# ⚠️ supervisor ve todas (no hace nada, porque es el else implícito)
```

**Paso 3: Modificar frontend - Columnas visibles**
```javascript
// frontend/src/pages/WorkOrdersPage.jsx
// ANTES:
const canSeeAdminColumns = useMemo(() => 
  user?.role === 'admin' || user?.role === 'coordinator' || 
  user?.role === 'operator' || user?.role === 'super_user',
  [user]
);

// DESPUÉS:
const canSeeAdminColumns = useMemo(() => 
  user?.role === 'admin' || user?.role === 'coordinator' || 
  user?.role === 'operator' || user?.role === 'super_user' ||
  user?.role === 'supervisor',  // ← Hardcodear nuevo rol
  [user]
);
```

**Paso 4: Modificar frontend - Botones de acciones**
```javascript
// En cada componente que tenga botones según rol:
// WorkOrdersPage.jsx, TicketDetailPage.jsx, etc.

const canAssignTechnicians = 
  user?.role === 'admin' || 
  user?.role === 'coordinator' ||
  user?.role === 'supervisor';  // ← Agregar en cada lugar

const canDeleteWorkOrders = 
  user?.role === 'admin' || 
  user?.role === 'coordinator';  // ← supervisor NO puede
```

### 🚨 Problemas de esta Aproximación

1. **Cambios en múltiples archivos**: Agregar 1 rol = modificar 3-5 archivos
2. **Falta de trazabilidad**: ¿Dónde más se usa "admin"? `grep` masivo
3. **Inconsistencias**: Olvidaste agregar supervisor en 1 lugar → bug sutil
4. **No escalable**: Con 10 roles, tenés chequeos de 10 strings en cada if
5. **Acoplamiento**: Backend y frontend deben conocer nombres exactos de roles
6. **Testing complejo**: Necesitás mockear roles en cada test

---

## ✅ Propuesta: Sistema Basado en Permisos (RBAC Modular)

### Arquitectura Mejorada

```
┌──────────────────────────────────────────────────────────┐
│ Base de Datos: Modelo de Permisos                        │
├──────────────────────────────────────────────────────────┤
│  roles                    permissions                     │
│  ├─ id                    ├─ id                          │
│  ├─ name                  ├─ name (slug)                 │
│  └─ display_name          ├─ resource (work_orders)      │
│                           └─ action (view_all, create)   │
│                                                           │
│  role_permissions (join table)                           │
│  ├─ role_id                                              │
│  └─ permission_id                                        │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Backend: Núcleo de Permisos                              │
├──────────────────────────────────────────────────────────┤
│  src/core/permissions.py                                 │
│  ├─ class Permission(Enum)                               │
│  │   └─ WORK_ORDERS_VIEW_ALL = "work_orders.view_all"   │
│  │   └─ WORK_ORDERS_ASSIGN = "work_orders.assign"       │
│  ├─ has_permission(user, permission) -> bool             │
│  └─ require_permission(permission) -> Dependency         │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ JWT: Incluye permisos del usuario                        │
├──────────────────────────────────────────────────────────┤
│  {                                                        │
│    "sub": "123",                                         │
│    "role": "supervisor",                                 │
│    "permissions": [                                      │
│      "work_orders.view_all",                            │
│      "work_orders.assign",                              │
│      "tickets.view_all"                                 │
│    ]                                                     │
│  }                                                       │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Frontend: Verificación abstracta                         │
├──────────────────────────────────────────────────────────┤
│  src/hooks/usePermissions.js                             │
│  └─ const canViewAllWO = hasPermission(                 │
│        'work_orders.view_all'                            │
│      )                                                   │
└──────────────────────────────────────────────────────────┘
```

### Implementación Paso a Paso

#### 1️⃣ Migración de Base de Datos

```sql
-- Tabla de permisos
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,  -- 'work_orders.view_all'
    resource VARCHAR(50) NOT NULL,       -- 'work_orders'
    action VARCHAR(50) NOT NULL,         -- 'view_all'
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla intermedia roles ↔ permisos
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Seedear permisos básicos
INSERT INTO permissions (name, resource, action, description) VALUES
    ('work_orders.view_all', 'work_orders', 'view_all', 'Ver todas las órdenes de trabajo'),
    ('work_orders.view_own', 'work_orders', 'view_own', 'Ver solo órdenes propias'),
    ('work_orders.create', 'work_orders', 'create', 'Crear órdenes de trabajo'),
    ('work_orders.assign', 'work_orders', 'assign', 'Asignar técnicos a OTs'),
    ('work_orders.delete', 'work_orders', 'delete', 'Eliminar órdenes de trabajo');

-- Asignar permisos a roles existentes
-- Admin: todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'admin';

-- Técnico: solo ver propias
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'tecnico' AND p.name = 'work_orders.view_own';

-- Supervisor: ver todas + asignar
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'supervisor' 
  AND p.name IN ('work_orders.view_all', 'work_orders.assign');
```

#### 2️⃣ Backend: Núcleo de Permisos

**Archivo: `backend/src/core/permissions.py`**
```python
from enum import Enum
from functools import wraps
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.models.user import User


class Permission(str, Enum):
    """Enumeración centralizada de permisos del sistema."""
    
    # Work Orders
    WORK_ORDERS_VIEW_ALL = "work_orders.view_all"
    WORK_ORDERS_VIEW_OWN = "work_orders.view_own"
    WORK_ORDERS_CREATE = "work_orders.create"
    WORK_ORDERS_ASSIGN = "work_orders.assign"
    WORK_ORDERS_DELETE = "work_orders.delete"
    
    # Tickets
    TICKETS_VIEW_ALL = "tickets.view_all"
    TICKETS_CREATE = "tickets.create"
    TICKETS_ASSIGN = "tickets.assign"
    
    # Users
    USERS_MANAGE = "users.manage"
    USERS_VIEW = "users.view"


def get_user_permissions(db: Session, user: User) -> List[str]:
    """
    Obtiene todos los permisos del usuario basados en su rol.
    
    Returns:
        Lista de strings: ["work_orders.view_all", "tickets.create", ...]
    """
    if not user.role:
        return []
    
    # Query con join optimizado
    from src.models.auth import RolePermission, PermissionModel
    
    permissions = (
        db.query(PermissionModel.name)
        .join(RolePermission, RolePermission.permission_id == PermissionModel.id)
        .filter(RolePermission.role_id == user.role_id)
        .all()
    )
    
    return [p.name for p in permissions]


def has_permission(user: User, permission: Permission, db: Session) -> bool:
    """
    Verifica si un usuario tiene un permiso específico.
    
    Args:
        user: Usuario autenticado
        permission: Permiso a verificar (enum)
        db: Sesión de base de datos
    
    Returns:
        True si tiene el permiso, False si no
    """
    if user.is_superuser:
        return True
    
    user_permissions = get_user_permissions(db, user)
    return permission.value in user_permissions


def require_permission(permission: Permission):
    """
    Decorador para endpoints que requieren permisos específicos.
    
    Usage:
        @router.get("/work-orders")
        @require_permission(Permission.WORK_ORDERS_VIEW_ALL)
        def list_all_work_orders(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extraer user y db de los argumentos del endpoint
            user = kwargs.get('current_user')
            db = kwargs.get('db')
            
            if not user or not db:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Configuración de permisos incorrecta"
                )
            
            if not has_permission(user, permission, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permiso requerido: {permission.value}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

#### 3️⃣ Backend: Actualizar Generación de JWT

**Archivo: `backend/src/services/auth_service.py`**
```python
from src.core.permissions import get_user_permissions

def login(self, email: str, password: str, ...) -> Optional[Token]:
    user = self.authenticate_user(email, password)
    if not user:
        return None
    
    # Obtener permisos del usuario
    permissions = get_user_permissions(self.session, user)
    
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "is_superuser": user.is_superuser,
            "role": user.role.name if user.role else None,
            "permissions": permissions,  # ← Lista de permisos
        },
        expires_delta=expires_delta,
        token_type="access",
    )
    # ...
```

#### 4️⃣ Backend: Usar Permisos en Endpoints

**Archivo: `backend/src/routers/work_orders.py`**
```python
from src.core.permissions import Permission, has_permission

@router.get("", response_model=dict)
def list_work_orders(
    ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listado de OTs con filtros automáticos según PERMISOS."""
    
    base_query = db.query(WorkOrder)
    
    # ✅ En lugar de if role_name == "tecnico":
    if has_permission(current_user, Permission.WORK_ORDERS_VIEW_ALL, db):
        # Ver todas las OTs (admin, supervisor, coordinator)
        pass
    elif has_permission(current_user, Permission.WORK_ORDERS_VIEW_OWN, db):
        # Ver solo OTs propias (técnicos)
        base_query = base_query.filter(WorkOrder.technician_id == current_user.id)
    else:
        # Sin permisos: retornar vacío
        return {"items": [], "total": 0, "limit": limit, "offset": offset, "pages": 0}
    
    # ... resto del código sin cambios
```

#### 5️⃣ Frontend: Contexto de Permisos

**Archivo: `frontend/src/context/AuthContext.jsx`**
```javascript
const decodeToken = (accessToken) => {
  try {
    const payload = accessToken.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return {
      id: parseInt(decoded.sub, 10),
      email: decoded.email,
      username: decoded.username,
      role: decoded.role,
      permissions: decoded.permissions || [],  // ← Array de permisos
      full_name: localStorage.getItem('emerald_full_name') || decoded.email,
    };
  } catch (err) {
    console.error('Error decodificando token:', err);
    return null;
  }
};
```

**Archivo: `frontend/src/hooks/usePermissions.js`** (nuevo)
```javascript
import { useAuth } from '@/context/AuthContext';

export const usePermissions = () => {
  const { user } = useAuth();
  
  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };
  
  const hasAnyPermission = (...permissions) => {
    return permissions.some(p => hasPermission(p));
  };
  
  const hasAllPermissions = (...permissions) => {
    return permissions.every(p => hasPermission(p));
  };
  
  return { hasPermission, hasAnyPermission, hasAllPermissions };
};

// Constantes de permisos (sync con backend)
export const Permissions = {
  WORK_ORDERS_VIEW_ALL: 'work_orders.view_all',
  WORK_ORDERS_VIEW_OWN: 'work_orders.view_own',
  WORK_ORDERS_CREATE: 'work_orders.create',
  WORK_ORDERS_ASSIGN: 'work_orders.assign',
  WORK_ORDERS_DELETE: 'work_orders.delete',
  TICKETS_VIEW_ALL: 'tickets.view_all',
  // ...
};
```

#### 6️⃣ Frontend: Usar Permisos en Componentes

**Archivo: `frontend/src/pages/WorkOrdersPage.jsx`**
```javascript
import { usePermissions, Permissions } from '@/hooks/usePermissions';

export default function WorkOrdersPage() {
  const { hasPermission } = usePermissions();
  
  // ✅ En lugar de chequear roles:
  const canSeeAdminColumns = hasPermission(Permissions.WORK_ORDERS_VIEW_ALL);
  const canAssignTechnicians = hasPermission(Permissions.WORK_ORDERS_ASSIGN);
  const canDeleteWorkOrders = hasPermission(Permissions.WORK_ORDERS_DELETE);
  
  return (
    // ...
    {canSeeAdminColumns && (
      <TableHead>Asignada</TableHead>
    )}
    
    {canAssignTechnicians && (
      <Button onClick={handleAssign}>Asignar Técnico</Button>
    )}
    
    {canDeleteWorkOrders && (
      <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
    )}
  );
}
```

---

## 🆚 Comparación: Antes vs. Después

### Agregar Nuevo Rol "Supervisor"

| Aspecto | ❌ Sistema Actual | ✅ Sistema Modular |
|---------|-------------------|-------------------|
| **Paso 1: BD** | `INSERT INTO roles` | `INSERT INTO roles` |
| **Paso 2: Asignar permisos** | N/A (hardcoded) | `INSERT INTO role_permissions` |
| **Paso 3: Backend** | Modificar 3-5 archivos con `if role == "supervisor"` | **0 cambios** (permisos en BD) |
| **Paso 4: Frontend** | Modificar cada `user?.role === 'admin' \|\| ...` | **0 cambios** (permisos en JWT) |
| **Testing** | Mockear rol "supervisor" en 10 tests | Mockear 1 permission en JWT |
| **Mantenibilidad** | Alta complejidad | Baja complejidad |
| **Escalabilidad** | O(n) con cantidad de roles | O(1) - solo BD |

### Cambiar Permisos de un Rol Existente

**Escenario:** Los técnicos ahora pueden crear OTs propias

| ❌ Sistema Actual | ✅ Sistema Modular |
|-------------------|-------------------|
| 1. Modificar `work_orders.py`: agregar `if role == "tecnico"` en endpoint create | 1. `INSERT INTO role_permissions (tecnico, work_orders.create)` |
| 2. Modificar frontend: agregar botón "Crear OT" con `if user.role === 'tecnico'` | 2. **Nada más** - el botón ya existe con `hasPermission()` |
| 3. Reiniciar backend | 3. Los técnicos ya pueden crear (sin deploy) |
| 4. Redeploy frontend | |
| **Total:** 2 archivos modificados + deploy | **Total:** 1 query SQL |

---

## 📊 Métricas de Mejora

| Métrica | Sistema Actual | Sistema Modular | Mejora |
|---------|----------------|-----------------|--------|
| **Archivos tocados por nuevo rol** | 4-6 | 0 | -100% |
| **Tiempo de implementación** | 30-60 min | 5 min | -83% |
| **Riesgo de bugs** | Alto (olvidar 1 lugar) | Bajo (centralizado) | -70% |
| **Tests necesarios** | 1 por endpoint | 1 para permissions.py | -80% |
| **Acoplamiento** | Alto (frontend ↔ backend) | Bajo (JWT intermedio) | -50% |

---

## 🚀 Plan de Migración

### Fase 1: Preparación (Sin Breaking Changes)
1. Crear tablas `permissions` y `role_permissions`
2. Seedear permisos básicos
3. Implementar `src/core/permissions.py`
4. Agregar `permissions` al JWT (mantener `role`)

### Fase 2: Backend Migration
1. Reemplazar `if role_name == "tecnico"` por `has_permission(...)`
2. Tests unitarios de permissions
3. Validar con Postman/tests

### Fase 3: Frontend Migration
1. Crear `usePermissions()` hook
2. Reemplazar checks de roles por checks de permisos
3. Tests E2E

### Fase 4: Deprecación
1. Remover campos `role` de comparaciones (mantener en JWT por legacy)
2. Documentar sistema nuevo
3. Monitorear 1 semana en producción

**Tiempo estimado:** 2-3 días de desarrollo + 1 semana de validación

---

## 📝 Conclusión

### Estado Actual: Funcional pero No Escalable
- ✅ Funciona correctamente para los 4-5 roles actuales
- ⚠️ Cada nuevo rol = modificar múltiples archivos
- ❌ Alto acoplamiento entre frontend y backend
- ❌ Difícil de testear y mantener

### Sistema Propuesto: Production-Ready
- ✅ Agregar roles sin tocar código
- ✅ Cambiar permisos sin redeploy
- ✅ Single source of truth (base de datos)
- ✅ Fácil de testear (mock permissions en JWT)
- ✅ Auditabilidad (log de cambios en role_permissions)

### Recomendación
**Implementar sistema modular antes de:**
- Agregar más de 2 roles nuevos
- Implementar features con permisos granulares (ej: "editar solo OTs propias")
- Escalar a múltiples frontends (app móvil, admin panel separado)

---

**Siguiente Paso:** ¿Implementar migration plan o documentar como deuda técnica?
