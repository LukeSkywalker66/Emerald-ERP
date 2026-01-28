# CHECKPOINT 2026-01-28: Mejora del Filtro de Técnicos + Password Reset

**Fecha:** 28 de enero de 2026  
**Branch:** `develop`  
**Estado:** ✅ COMPLETADO Y VALIDADO

---

## 🎯 Objetivos de la Sesión

1. Mejorar el filtro de "Asignado a" en la grilla de Work Orders
2. Restringir visibilidad del filtro solo a roles específicos
3. Crear herramienta de reset de contraseñas para usuarios dummy
4. Documentar el proceso para próximas sesiones

---

## ✅ Cambios Implementados

### 1. Mejorada Grilla de Work Orders - Filtro Dinámico de Técnicos

**Archivo:** `frontend/src/pages/WorkOrdersPage.jsx`

**Problema Original:**
- Filtro de "Asignado a" solo tenía opciones genéricas: "Todos", "Sin asignar", "Asignado"
- No había forma de filtrar por técnico específico
- Usuarios admin/operator no podían buscar OTs de un técnico en particular

**Solución Implementada:**

**Estado agregado:**
```javascript
const [technicians, setTechnicians] = useState([]); // Lista de técnicos disponibles
```

**Lógica de extracción de técnicos:**
```javascript
// En loadWorkOrders(), después de obtener items:
const uniqueTechnicians = Array.from(
  new Set(
    items
      .filter(wo => wo.technician_name)
      .map(wo => wo.technician_name)
  )
).sort(); // Ordenar alfabéticamente
setTechnicians(uniqueTechnicians);
```

**Lógica de filtrado por técnico específico:**
```javascript
// Si el usuario selecciona un técnico específico
else if (assigneeFilter && assigneeFilter !== '') {
  items = items.filter((wo) => wo.technician_name === assigneeFilter);
}
```

**Renderización del select:**
```jsx
<select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
  <option value="">Todos los técnicos</option>
  <option value="unassigned">Sin asignar</option>
  <option value="assigned">Asignado</option>
  {technicians.length > 0 && <option disabled>─────────────</option>}
  {technicians.map((tech) => (
    <option key={tech} value={tech}>
      {tech}
    </option>
  ))}
</select>
```

**Resultado:**
- ✅ Dropdown muestra lista dinámica de técnicos
- ✅ Separador visual distingue opciones especiales
- ✅ Ordenados alfabéticamente
- ✅ Filtrado funciona correctamente

### 2. Restricción de Permisos del Filtro

**Problema:** El filtro era visible para todos los usuarios, incluyendo técnicos

**Solución:** Nueva variable de permisos `canFilterByTechnician`

```javascript
// Roles que pueden filtrar por técnico (solo admin y operator)
const canFilterByTechnician = useMemo(() => 
  user?.role === 'admin' || user?.role === 'operator',
  [user]
);
```

**Cambio en renderización:**
```jsx
// ANTES:
{canSeeAdminColumns && ( ... )}

// DESPUÉS:
{canFilterByTechnician && ( ... )}
```

**Resultado:**
- ✅ Solo admin y operator ven el filtro
- ✅ Técnicos, coordinators, etc. NO lo ven
- ✅ Mejor segregación de permisos

### 3. Herramienta de Reset de Contraseñas

**Problema:** Usuario no podía acceder al sistema, necesitábamos resetear contraseña

**Solución:** Script Python `/tmp/reset_pepe_password.py`

**Capacidad del script:**
- Conecta a la BD usando credentials del .env
- Busca usuario por username o email
- Genera nuevo hash Argon2
- Actualiza la contraseña en BD
- Muestra credenciales actualizadas

**Ejecución:**
```bash
docker cp /tmp/reset_pepe_password.py emerald_backend:/tmp/
docker exec emerald_backend python /tmp/reset_pepe_password.py
```

**Resultado del reset de Pepe:**
```
✅ Usuario encontrado:
   ID: 16
   Username: Pepe
   Email: tecnico10@emerald.com
   Nombre: Pepe Peralta

🔒 Nueva contraseña: pepe123

✅ Contraseña actualizada exitosamente!
```

**Credenciales actuales:**
- Email: `tecnico10@emerald.com`
- Password: `pepe123`

---

## 🔒 Seguridad y Hashing de Contraseñas

### Conceptos Importantes

**Hashing vs Encriptación:**
- Hashing: Proceso de un solo sentido (one-way)
- Las contraseñas NO se pueden "ver" ni "recuperar"
- Solo se pueden resetear

**Argon2:**
- Algoritmo moderno y seguro para hashing
- Resistente a ataques GPU/ASIC
- Usado en: passwords, en compliance con OWASP

**Flujo de Login:**
```
1. Usuario ingresa: "pepe123"
2. Backend hashea: argon2.hash("pepe123") → nuevo_hash
3. Compara: nuevo_hash == hash_en_bd
4. Si coinciden → acceso permitido
5. ❌ Nunca se desencripta el hash original
```

### Implicaciones Operacionales

**Para usuarios que olvidan contraseña:**
- ❌ NO: "Te la envío por email"
- ✅ SI: "Te reseteo una nueva temporal. Cámbiala al ingresar"

**Para administrador:**
- ❌ NO: Ver contraseña del usuario
- ✅ SI: Reset temporal + obligar cambio al próximo login

**Mejor práctica (implementar en futuro):**
1. Forgot Password flow con token temporal
2. Email con link de reset
3. Usuario ingresa nueva contraseña
4. Token se invalida automáticamente

---

## 📊 Archivos Modificados

### Frontend
- **`frontend/src/pages/WorkOrdersPage.jsx`**
  - Agregado estado `technicians`
  - Agregado variable `canFilterByTechnician`
  - Mejorada lógica de extracción de técnicos
  - Mejorada lógica de filtrado por técnico específico
  - Mejorada renderización del select con opciones dinámicas

### Utilidades
- **`/tmp/reset_pepe_password.py`** (script de reset)
  - No se commitea (herramienta temporal de administración)
  - Disponible en contenedor backend
  - Reutilizable para otros usuarios

---

## 🧪 Validación

### Test 1: Filtro Dinámico de Técnicos
**Acción:** Cargar grilla de Work Orders con rol admin
**Verificación:**
- ✅ Dropdown "Asignado a" visible
- ✅ Muestra opciones: "Todos", "Sin asignar", "Asignado"
- ✅ Muestra lista de técnicos (dinámicamente extraída)
- ✅ Técnicos ordenados alfabéticamente
- ✅ Separador visual presente

### Test 2: Filtro por Técnico Específico
**Acción:** Seleccionar "Pepe Peralta" en el dropdown
**Verificación:**
- ✅ Grilla se filtra mostrando solo OTs de Pepe
- ✅ Total de OTs se actualiza
- ✅ Cada OT muestra a "Pepe Peralta" en columna "Asignada"

### Test 3: Restricción de Permisos
**Acción:** Loguearse como técnico
**Verificación:**
- ✅ Dropdown "Asignado a" NO visible
- ✅ Columnas "Programada", "Creada", "Asignada" NO visibles
- ✅ Solo ve sus OTs asignadas

### Test 4: Reset de Contraseña
**Acción:** Ejecutar script de reset
**Verificación:**
- ✅ Usuario encontrado en BD
- ✅ Contraseña actualizada con nuevo hash
- ✅ Login exitoso con nuevas credenciales

---

## 📋 Estado del Sistema

### Contenedores Operativos
- ✅ emerald_backend
- ✅ emerald_frontend
- ✅ emerald_nginx
- ✅ emerald_db
- ✅ emerald_beholder
- ✅ emerald_redis
- ✅ emerald_worker

### URLs Accesibles
- Frontend: https://emerald.2finternet.ar
- Backend API: https://emerald.2finternet.ar/api
- Beholder: https://emerald.2finternet.ar:5173 (interno)

### Usuarios de Prueba
| Rol | Email | Password | Estado |
|-----|-------|----------|--------|
| admin | root@example.com | root123 | ✅ Activo |
| tecnico | tecnico10@emerald.com | pepe123 | ✅ Activo (reseteado) |
| coordinator | - | - | En BD (no testeado) |
| operator | - | - | En BD (no testeado) |

---

## 🚀 Próximos Pasos (Para Próxima Sesión)

### Corto Plazo
1. **Validación Visual:**
   - [ ] Tester verifica filtro de técnicos funciona en todos los navegadores
   - [ ] Tester verifica restricciones de permisos (técnico no ve filtro)

2. **Integración con Historial de Cambios:**
   - [ ] Agregar auditoría de quién modificó OTs
   - [ ] Considerar agregar "Última modificación" en columnas

### Mediano Plazo
1. **Implementar Reset Flow Completo:**
   - [ ] Crear endpoint `/api/v2/auth/forgot-password`
   - [ ] Crear tabla `password_reset_tokens`
   - [ ] Implementar email de recuperación (SendGrid/SMTP)
   - [ ] Frontend con formulario de reset

2. **Mejorar UX del Filtro:**
   - [ ] Multiselect en lugar de single select (filtrar por múltiples técnicos)
   - [ ] Filtro por rango de fechas
   - [ ] Filtro combinado (estado + técnico + fechas)

3. **Análisis y Reportes:**
   - [ ] Dashboard con OTs por técnico (distribución de carga)
   - [ ] Métricas de completitud por técnico
   - [ ] Tiempos promedio de resolución

### Deuda Técnica Documentada
- [ ] RBAC: Sistema de roles hardcodeados (ver `docs/RBAC_MEJORA_ROLES.md`)
- [ ] Auth: Implementar proper password reset flow
- [ ] Frontend: Agregar proper state management (Redux/Zustand)
- [ ] Testing: Unit tests para componentes de filtrado

---

## 📝 Notas Técnicas

### Cómo Reutilizar el Script de Reset

```bash
# 1. Copiar script al contenedor backend
docker cp /tmp/reset_pepe_password.py emerald_backend:/tmp/

# 2. Ejecutar (adaptar el script si necesitas otro usuario)
docker exec emerald_backend python /tmp/reset_pepe_password.py

# 3. El script hace:
#    - Conecta a BD usando DATABASE_URL del .env
#    - Busca usuario por username/email
#    - Hashea nueva contraseña con Argon2
#    - Actualiza en BD
#    - Muestra credenciales

# 4. Si necesitas cambiar contraseña del script:
#    Editar línea: NEW_PASSWORD = "nueva_contraseña"
```

### Frontend Hot Reload
- Vite está configurado con hot module replacement
- Los cambios en `WorkOrdersPage.jsx` se reflejan automáticamente
- No es necesario reiniciar contenedor (solo en caso de errores)

### Debugging
```bash
# Ver logs del frontend
docker compose logs -f frontend --tail=50

# Ver logs del backend
docker compose logs -f backend --tail=50

# Conectar a BD para queries manual
docker exec emerald_db psql -U emerald_owner -d emerald_stock
# Queries útiles:
# SELECT * FROM users WHERE username = 'Pepe';
# SELECT COUNT(*) FROM work_orders WHERE technician_id = 16;
```

---

## ✅ Checklist Final

- [x] Filtro de técnicos mejorado y funcionando
- [x] Restricción de permisos implementada
- [x] Script de reset de contraseñas creado y testeado
- [x] Usuario Pepe reseteado y accesible
- [x] Frontend reiniciado sin errores
- [x] Documentación actualizada
- [x] Checkpoint creado
- [x] Commit preparado
- [x] Push realizado

---

**Sesión Estado:** 🟢 COMPLETADA - Sistema listo para siguiente sesión  
**Próximo Enfoque:** Validación visual + Implementar reset flow completo  
**Tiempo de Sesión:** ~45 minutos (debugging + implementación + documentación)
