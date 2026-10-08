# RBAC backend-authority — Estrategia de propagación modular

**Propósito:** dejar sentadas las bases para extender el criterio "autorización en backend, frontend como renderizador" al resto de la aplicación **sin un revuelo masivo**, atacando módulo por módulo según surjan modificaciones o fixes.

**Regla de oro:** cada vez que se toque un módulo por cualquier motivo, se migra su RBAC al nuevo patrón en el mismo cambio. No se hacen refactors "big bang".

---

## 1. Criterio canónico (a replicar en todo módulo)

1. **Backend:** el permiso se define en `roles.permissions` como slug `{recurso}.{accion}` (ver catálogo en [`PLAN_RBAC_BACKEND_AUTHORITY.md`](plans/PLAN_RBAC_BACKEND_AUTHORITY.md:3)).
2. **Backend:** el endpoint autoriza con `require_permission(...)` (nunca con comparación de nombre de rol).
3. **Backend:** expone capabilities en `GET /api/v1/auth/me`.
4. **Frontend:** `Can` / `RoleGuard` / menú / rutas consultan capabilities (`can(...)`), no matchean strings de rol.
5. **Frontend:** ocultar es UX; la seguridad real está siempre en backend.

---

## 2. Cómo se propaga módulo a módulo

Para cada módulo, cuando se lo toque:

1. Inventariar sus endpoints y las pantallas/acciones que usan.
2. Mapear cada acción a un slug `{recurso}.{accion}` (usar el catálogo; agregar slug si es nuevo, documentándolo).
3. Agregar `require_permission` en los endpoints que aún no lo tienen.
4. Migrar los gates de frontend de ese módulo a `can(...)`.
5. Verificar que los roles existentes (`admin`, `operator`, `coordinator`, `tecnico`) reciban el permiso equivalente para **no cambiar comportamiento**.
6. Sumar el permiso al rol `tecnico_encargado` si corresponde.
7. Eliminar el `if role_name == "..."` / substring de ese módulo.

---

## 3. Orden sugerido de módulos (por fricción creciente)

1. Tickets (ya tocado por otros fixes).
2. Work Orders / Coordinación (alto uso, gated por rol).
3. Inventario / Logística.
4. Engineering.
5. Flota.
6. Red y Clientes.
7. Usuarios / Settings / Auditoría.

---

## 4. Garantías de no regresión

- **Convivencia:** mientras no se migre un módulo, sigue usando la matriz actual (`PERMISSIONS_MATRIX`), que se mantiene como fallback.
- **Aditivo:** las Fases 0-3 agregan capabilities y endpoints nuevos; no quitan el comportamiento existente.
- **Fail-safe:** permiso no reconocido → denegado; durante la migración, si el frontend no tiene capabilities, cae a la matriz vieja.
- **Check de equivalencia:** al migrar un módulo, se verifica que cada rol actual conserve exactamente los mismos accesos (tabla de equivalencia en la sección 5).

---

## 5. Tabla de equivalencia matriz actual → slugs

| Recurso/acción actual (matriz) | Slug canónico |
|--------------------------------|---------------|
| dashboard.view | `dashboard.view` |
| tickets.view/create/edit/comment | `tickets.*` |
| coordination.view/assign/unassign/view_teams | `coordination.*` |
| work_orders.view/view_all/create/edit/complete | `work_orders.*` |
| engineering.view/manage | `engineering.*` |
| cuadrillas.view/create/edit/delete/assign_members | `cuadrillas.*` |
| inventory.view/view_all/edit/transfer/adjust | `inventory.*` |
| inventory_warehouses.view | `inventory_warehouses.view` |
| inventory_admin.view | `inventory_admin.view` |
| fleet_assigned.view | `fleet_assigned.view` |
| users.* | `users.*` |
| settings.view/edit | `settings.*` |
| audit_logs.view | `audit_logs.view` |
| connections/nodes/clients.view | `connections.view` / `nodes.view` / `clients.view` |
| self_service.view/edit | `self_service.*` |
| (capacidad de cuadrilla, nueva) | `teams.member` |

---

## 6. Checklist de propagación (por módulo)

- [ ] Endpoints con `require_permission`
- [ ] Frontend con `can(...)`
- [ ] Roles existentes con permisos equivalentes (sin cambio de comportamiento)
- [ ] Rol `tecnico_encargado` actualizado si aplica
- [ ] Sin `role_name == "..."` ni substring en ese módulo
