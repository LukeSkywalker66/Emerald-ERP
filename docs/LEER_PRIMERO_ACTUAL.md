# 🚀 LEER PRIMERO - Emerald ERP (Actualizado 21 Marzo 2026)

**Última actualización:** 21 de Marzo 2026, 18:30 hs  
**Estado del proyecto:** Fase B Completada, Coordinación + Fleet Operativos ✅

---

## 📋 Contexto Rápido (30 segundos)

Emerald ERP es un sistema de gestión para ISP en Argentina. Stack: **Python 3.11 (FastAPI) + React + Vite + PostgreSQL 15**.

**Estado Actual (21 Mar 2026):**
- ✅ Módulo de Inventario completo y funcional
- ✅ Módulo de Coordinación (grilla de tareas) con sincronización en tempo real
- ✅ Módulo de Flota (inspecciones diarias de vehículos)
- ✅ Sistema de Auditoría Universal (AuditLog)
- ✅ OT Creation centralizado con validaciones
- ✅ Work Orders con múltiples estados y transiciones seguras
- ✅ Auth JWT con Refresh Tokens y Rate Limiting
- ✅ Frontend build sin errores + optimizaciones de performance

**Próximo paso crítico:** Estabilización de bugs menores y optimizaciones funcionales

---

## 🎯 Módulos Implementados

### ✅ Autenticación (Auth)
- JWT con Access Token + Refresh Token
- Rate Limiting de intentos fallidos
- Audit trail de logins
- Roles: admin, coordinator, operator, tecnico, super_user

### ✅ Tickets & Work Orders (OT)
- Creación centralizada de OT desde tickets
- Estados: pending_planning → assigned → in_progress → pending_closure → completed
- Protocolo de La Tormenta: rescue para OT vencidas (read-only en histórico)
- Cierre con fotos y notas obligatorias
- Materiales persistentes en OT

### ✅ Coordinación (Scheduling)
- Grilla de tareas con granularidad de 15 minutos
- Sincronización automática (polling 5s, solo para hoy)
- Histórico de coordinación (sin polling para fechas pasadas)
- Drag & drop bidireccional
- Estados visuales y colores por prioridad
- Sidebar con backlog de OTs sin asignar

### ✅ Flota (Fleet)
- Inspecciones diarias pre-salida (15+ campos)
- Normalización de niveles: bajo/minimo/medio/alto
- Historial de inspecciones visualizable
- Validación de control previo antes de ejecutar OTs
- Control unitario por técnico (incluso en cuadrillas compartidas)

### ✅ Inventario
- Almacenes: central, móviles (técnicos), virtuales
- Productos: serializados (ONU, router) y a granel (cables, conectores)
- Stock movements con auditoría completa
- Transferencias BULK y SERIALIZED con wizard
- Integración con Work Orders (consumo de materiales)

### ✅ Auditoría Universal
- AuditLog centralizado (inserciones, updates, deletes)
- Trazabilidad de cambios con usuario, timestamp, cambios_delta
- Vista de auditoría pública

---

## 🗂️ Archivos Críticos Actualizados

### Antes de tocar código:
1. **`.github/copilot-instructions.md`** → Reglas estrictas de codificación
2. **`docs/ARQUITECTURA_TICKETS_V2.md`** → Arquitectura modular
3. **`ROADMAP.md`** → Plan general

### Para desarrollo:
4. **`backend/src/models/`** → Modelos SQLAlchemy (User, Ticket, WorkOrder, Team, VehicleInspection)
5. **`frontend/src/pages/coordination/`** → Grilla de coordinación
6. **`frontend/src/pages/fleet/`** → Módulo de flota
7. **`backend/src/routers/fleet.py`** → Endpoints de inspecciones

---

## 🐛 Bugs Recién Corregidos (Esta Sesión)

1. ✅ **Inspección Diaria Bloqueada** → Rol técnico no se detectaba correctamente
2. ✅ **Latido Visual en Coordinación** → Barra de carga causa layout shift
3. ✅ **Histórico Desaparece** → Polling automático limpiaba datos de fechas pasadas

---

## ⚡ Comandos Quick Start

### Ver estado de contenedores:
```bash
cd /opt/emerald-erp
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
```

### Levantar servicios:
```bash
docker-compose up -d
```

### Testear un endpoint:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8500/v2/work-orders/coordination/grid?start_date=2026-03-21&end_date=2026-03-21
```

### Ver logs de backend:
```bash
docker logs -f emerald_backend
```

### Ejecutar migrations Alembic:
```bash
cd backend && alembic upgrade head
```

---

## 📝 Próximas Tareas Prioritarias

1. 🔴 **Performance**: Optimizar queries de coordinación para > 500 OTs
2. 🔴 **Validaciones**: Hardening de transiciones de estado en OT
3. 🟡 **UX**: Mejorar feedback visual en ediciones drag & drop
4. 🟡 **Testing**: E2E automatizados para flujos críticos
5. 🟢 **Documentación**: Completar API reference

---

## 🆘 Troubleshooting Rápido

### "La grilla de coordinación no carga"
1. Verifica que backend está arriba: `docker ps | grep emerald_backend`
2. Revisa logs: `docker logs emerald_backend | tail -50`
3. Verifica token válido en localStorage

### "Las inspecciones no aparecen"
1. Verifica que el técnico pertenece a una cuadrilla con vehículo
2. Revisa que la cuadrilla tiene `vehicle_id` asignado
3. Intenta refrescar (F5)

### "Los datos históricos desaparecen"
1. Esto ya está corregido (commit 0694c00)
2. Si persiste, verifica que no estés haciendo refetch manual

---

## 📞 Contacto y Contexto

Para nueva sesión, menciona:
- **Estado actual**: Fase B (Coordinación + Fleet) completada
- **Última tarea**: Arreglo de bugs de UI y sincronización
- **Branch**: develop (sin merge a master; staging en revisión)

**Prompt ideal para Copilot:**
```
Estoy en Emerald ERP (21 Mar 2026). Fase B completa: Coordinación + Fleet operativos.
Acabamos de corregir: inspección bloqueada, latido visual, histórico que desaparece.
¿Qué quieres que arregle ahora?
```
