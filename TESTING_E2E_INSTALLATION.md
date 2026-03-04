# E2E Testing - Installation Workflow

**Fecha:** 3 de marzo de 2026  
**Estado:** Ready for Testing  
**Objetivo:** Validar flujo completo: DNI lookup → Nueva conexión → Sync cliente → Ticket creado → Rollback limpio

---

## 🎯 Precondiciones

- ✅ Docker corriendo (`emerald_db`, `emerald_backend`, `emerald_frontend`)
- ✅ `installation_types` tabla creada y poblada (fiber, wireless, hybrid)
- ✅ `/v2/installation-types` endpoint funcional
- ✅ `InstallationWizard` integrado y cargando tipos dinámicamente
- ✅ Rollback script disponible para limpieza post-test

---

## 📋 Test Case 1: Nueva Instalación - Cliente Nuevo (Happy Path)

### Paso 1: Verificar endpoint de tipos de instalación

**Backend Validation:**
```bash
curl -s http://localhost:8500/api/v2/installation-types | jq .
```

**Esperado:**
```json
[
  {
    "id": 1,
    "code": "fiber",
    "name": "Fibra Óptica (FTTH)",
    "description": "...",
    "is_active": true,
    "created_at": "...",
    "updated_at": "..."
  },
  {
    "id": 2,
    "code": "wireless",
    "name": "Inalámbrico - Antena domiciliaria",
    "description": "...",
    "is_active": true
  },
  {
    "id": 3,
    "code": "hybrid",
    "name": "Híbrido",
    "description": "...",
    "is_active": true
  }
]
```

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

### Paso 2: Acceder al Wizard de Nueva Instalación

**Acción:**
1. Navegar a **Nuevo Ticket** → Seleccionar tipo **Instalación**
2. El wizard debe mostrar 3 pasos

**Step 1 - DNI/CUIT/CUIL Lookup:**
- Camp DNI/CUIT/CUIL debe:
  - ✓ Aceptar 7-9 dígitos (DNI) O 11 dígitos (CUIT/CUIL)
  - ✓ Validar formato en tiempo real
  - ✓ Mostrar mensaje "DNI, CUIT o CUIL"

**Testing con cliente NUEVO (no sincronizado):**
- Usar DNI: **12345678** (cliente ficticio, NO en ISPCube ni Emerald)
- O usar DNI: **20294562746** (USUARIO PRUEBA - ya existe en ambos)

**Para este test, usaremos:** **12345678** (completamente nuevo)

1. Ingresar DNI
2. Click "Buscar"
3. Servidor debe:
   - ✓ Consultar ISPCube por `/external/customer-lookup-new-connections?dni=12345678`
   - ✓ Filtrar solo conexiones NO en tabla `connections`
   - ✓ Retornar cliente + conexiones disponibles

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

### Paso 3: Seleccionar Conexión Nueva

**Esperado:**
- El wizard debe *mostrar* nuevas conexiones del cliente
- Mensaje tipo: "📊 X conexión(es) nueva(s) | Y ya en nuestra base"
- Select interactivo con opciones de conexión

**Acción:**
1. Seleccionar una conexión
2. Click "Siguiente"

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

### Paso 4: Seleccionar Tipo de Instalación (Dinámico)

**Esperado:**
- ✓ Select debe cargar tipos desde `/v2/installation-types` API
- ✓ Mostrar: **Fibra Óptica (FTTH)**, **Inalámbrico - Antena domiciliaria**, **Híbrido**
- ✓ NO debe ser hardcoded
- ✓ Debe estar habilitado para seleccionar

**Acción:**
1. Seleccionar: **Inalámbrico - Antena domiciliaria**
2. Ingresar disponibilidad: **Lunes 09:00-11:00**
3. Click "Crear Ticket"

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

### Paso 5: Validación Backend - Sync Pre-Ticket

**Backend Validation (durante creación de ticket):**

El backend DEBE ejecutar `sync_installation_context()` ANTES de crear el ticket:

```bash
# Ver logs del backend para confirmar sync
docker logs emerald_backend 2>&1 | grep -i "sync_installation\|ispcube" | tail -20
```

**Esperado en logs:**
```
[INFO] sync_installation_context: Resolviendo cliente desde DNI 12345678
[INFO] ISPCube customer lookup: Found customer {id: X, name: Y, ...}
[INFO] Filtrando conexiones nuevas (no en Emerald)
[INFO] Sincronizando cliente + conexión vía sync_cliente_instalacion
[INFO] Ticket creado exitosamente con evento de timelline
```

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

### Paso 6: Validación BD - Cliente + Conexión Sincronizados

**Database Validation:**

```bash
# 1. Verificar cliente creado
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT id, name, doc_number, code FROM clientes 
WHERE doc_number = '12345678' 
LIMIT 1;
"

# 2. Verificar conexión sincronizada
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT c.connection_id, c.customer_id, c.pppoe_username, c.direccion
FROM connections c
JOIN clientes cl ON c.customer_id = cl.id
WHERE cl.doc_number = '12345678'
LIMIT 1;
"

# 3. Verificar ticket creado
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT t.id, t.subject, t.ticket_type, t.installation_tech, 
       t.destination_connection_id, t.status, t.created_at
FROM tickets t
WHERE t.ticket_type = 'installation'
ORDER BY t.created_at DESC
LIMIT 1;
"

# 4. Verificar timeline con evento de sync
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT tl.id, tl.ticket_id, tl.content, tl.meta_data, tl.created_at
FROM ticket_timeline tl
WHERE tl.ticket_id = (
  SELECT MAX(id) FROM tickets WHERE ticket_type = 'installation'
)
ORDER BY tl.created_at DESC
LIMIT 1;
"
```

**Esperado:**
- ✅ Cliente con DNI 12345678 existe en `clientes`
- ✅ Conexión existe en `connections` con `customer_id` correcto
- ✅ Ticket existe con `destination_connection_id` correcto
- ✅ Timeline contiene evento humanizado: *"✅ Instalación: cliente confirmado desde ISPCube..."*
- ✅ `meta_data` incluye `customer_id`, `lookup_source`, `sync_timestamp`

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

### Paso 7: Validación UI - Ticket Visible en Dashboard

**Acción:**
1. Ir a **Tickets** / **Mis Tickets**
2. Buscar el ticket recién creado
3. Verificar:
   - ✓ Sujeto correcto
   - ✓ Estado: **open**
   - ✓ Tipo: **installation**
   - ✓ Tecnología: **Inalámbrico - Antena domiciliaria**
   - ✓ Timeline visible con evento humanizado

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

## 🧹 Test Case 2: Rollback Limpio

**Objetivo:** Verificar que el script rollback elimina ticket + cliente + conexión sin afectar ISPCube

### Paso 1: Ejecutar Rollback Script

```bash
cd /opt/emerald-erp
bash ./scripts/rollback_installation_test.sh
```

**Acción interactiva:**
1. El script mostrará últimos 5 tickets de instalación
2. Seleccionar opción **1** (eliminar último)
3. Confirmar con **s**

**Esperado:**
```
🔍 Obteniendo detalles...

Datos a eliminar:
  • Ticket ID: [último]
  • Connection ID: [XXX]
  • Customer ID: [XXX]

Registros asociados a eliminar:
  • Timeline events: [N]
  • Connection row: 1
  • Cliente row: 1
  • Cliente teléfonos: [si aplica]
  • Cliente emails: [si aplica]

¿Confirmar eliminación? (s/n): s

🗑️  Eliminando...

✅ Rollback completado exitosamente

Resumen de cambios:
  ✓ Ticket [ID] eliminado
  ✓ Conexión [ID] eliminada
  ✓ Cliente [ID] eliminado (alta nueva)
```

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

### Paso 2: Validar Eliminación Total

```bash
# Verificar que cliente NO existe
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT COUNT(*) as cliente_count FROM clientes 
WHERE doc_number = '12345678';
"

# Verificar que conexión NO existe
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT COUNT(*) as conexion_count FROM connections 
WHERE pppoe_username = '[username_creado]';
"

# Verificar que ticket NO existe
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT COUNT(*) as ticket_count FROM tickets 
WHERE subject LIKE '%[sujeto_creado]%';
"
```

**Esperado:**
- ✅ Cliente count: **0**
- ✅ Conexión count: **0**
- ✅ Ticket count: **0**
- ✅ Timeline limpia
- ✅ **ISPCube no fue tocado** (verificable: datos ficticios 12345678 nunca se crearon allá)

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

## 📊 Test Case 3: Cliente Existente (Multiple Conexiones)

**Objetivo:** Validar que rollback preserva cliente cuando tiene múltiples conexiones

### Setup:
```bash
# Usar cliente que YA existe con múltiples conexiones
# Ejemplo: DNI 20294562746 (USUARIO PRUEBA - 5 conexiones)
```

### Pasos:
1. Crear ticket de instalación para DNI **20294562746**
2. Seleccionar una de sus conexiones nuevas (o existente)
3. Crear ticket exitosamente
4. Ejecutar rollback
5. Verificar:
   - ✅ Ticket: **ELIMINADO**
   - ✅ Conexión: **ELIMINADO**
   - ✅ Cliente: **PRESERVADO** (tiene otras conexiones)

**Backend Query:**
```bash
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
SELECT COUNT(*) as conexiones_restantes FROM connections 
WHERE customer_id = 10911;
"
```

**Esperado:** `conexiones_restantes: 4` (tenía 5, se borró 1)

**Status:** ☐ PASADO / ☐ FALLIDO  
**Notas:** _______________________________________________

---

## 🔐 Test Case 4: Error Handling

### 4.1 DNI Inválido

**Acción:** Ingresar DNI malformado (ej: "ABC" o "123")

**Esperado:**
- ✓ UI valida y muestra error: **"DNI, CUIT o CUIL inválido (7-9 o 11 dígitos)"**
- ✓ Botón Buscar **deshabilitado**

**Status:** ☐ PASADO / ☐ FALLIDO

---

### 4.2 Cliente NO en ISPCube

**Acción:** Buscar DNI que NO existe en ISPCube (ej: 99999999)

**Esperado:**
- ✓ Backend retorna **404 o mensaje de error**
- ✓ UI muestra: **"Cliente no encontrado en ISPCube"**
- ✓ Wizard no permite continuar

**Status:** ☐ PASADO / ☐ FALLIDO

---

### 4.3 Cliente sin Nuevas Conexiones

**Acción:** Buscar cliente que ya tiene todas conexiones sincronizadas en Emerald

**Esperado:**
- ✓ UI muestra: **"No hay conexiones nuevas para este cliente"**
- ✓ Wizard permite avanzar pero advierte
- ✓ O bloquea creación del ticket

**Status:** ☐ PASADO / ☐ FALLIDO

---

## 📝 Checklist Final

| Item | Status |
|------|--------|
| Tipos de instalación cargan dinámicamente | ☐ OK / ☐ FAIL |
| Lookup DNI funciona (cliente nuevo) | ☐ OK / ☐ FAIL |
| Lookup DNI funciona (cliente existente) | ☐ OK / ☐ FAIL |
| Sync pre-ticket se ejecuta | ☐ OK / ☐ FAIL |
| Ticket se crea exitosamente | ☐ OK / ☐ FAIL |
| Timeline tiene evento humanizado | ☐ OK / ☐ FAIL |
| Meta_data JSONB auditable | ☐ OK / ☐ FAIL |
| Rollback elimina cliente nuevo | ☐ OK / ☐ FAIL |
| Rollback preserva cliente existente | ☐ OK / ☐ FAIL |
| Validación DNI frontend | ☐ OK / ☐ FAIL |
| Error handling ISPCube | ☐ OK / ☐ FAIL |
| Build sin regresos | ☐ OK / ☐ FAIL |

---

## 🐛 Si hay errores

### Logs útiles:

```bash
# Backend logs
docker logs emerald_backend -f --tail=50

# DB logs
docker logs emerald_db -f --tail=50

# Frontend console (Browser DevTools F12 → Console)
```

### Rollback de emergencia:

```bash
# Si algo rompe, limpiar manualmente:
bash ./scripts/rollback_installation_test.sh
```

---

## 📌 Notas

- **ISPCube:** No es afectado. Datos de prueba con DNI ficticio.
- **Transaccionalidad:** Cada operación es all-or-nothing.
- **Audit trail:** Meta_data JSONB preserva toda la información para auditoría sin contaminar UX.
- **Backward compatible:** Clientes existentes no son afectados.

---

**Test Completado:** ____________  
**Testeado por:** ________________  
**Bugs encontrados:** ____________  
**OK para Producción:** ☐ SI / ☐ NO
