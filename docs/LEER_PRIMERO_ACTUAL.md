# 🚀 LEER PRIMERO - Emerald ERP (Actualizado 06 Junio 2026)

**Última actualización:** 06 de Junio 2026, 11:00 hs
**Estado del proyecto:** Refurbish OT Module Completo ✅

---

## 📋 Contexto Rápido (30 segundos)

Emerald ERP es un sistema de gestión para ISP en Argentina. Stack: **Python 3.11 (FastAPI) + React 19 + Vite + PostgreSQL 15**.

**Estado Actual (06 Jun 2026):**
- ✅ **Refurbish OT Module** — Trazabilidad de activos, wizard 4 pasos, plantillas en Settings
- ✅ **Trazabilidad de serializados** — ConnectionAssets, SerialItem lifecycle tracking
- ✅ **Notas de conexión** — Técnicos dejan observaciones sobre conexiones
- ✅ **MaterialSelector unificado** — Mismo componente en ejecución y wizard de cierre
- ✅ **Backend completion engine** — `POST /work-orders/{id}/complete` con inventory effects
- ✅ **WO Templates en Settings** — Admin configura materiales sugeridos por tipo de visita
- ✅ **Wizard 4 pasos** — Resolución → Materiales → Fotos → Confirmación + Nota
- ✅ **Widget en TicketDetailPage** — Equipos instalados + Notas de técnicos en conexión
- ✅ **Fase 5 Geolocalización** — lat/lng en WorkOrders, parse-map-link, botón Google Maps
- ✅ **Dashboard refactor** — datos reales de API (sin mock data)
- ✅ **Monitoring Engine** — Service Monitors (Ping/HTTP/TCP/SSL) con Strategy Pattern
- ✅ **Scheduled Tasks V2** — Configuración persistente de tareas Celery desde DB
- ✅ **Settings Module** — SystemConfig key-value, ServiceMonitor CRUD desde UI
- ✅ **Sidebar Pin/Collapse** — hover-expand behavior + responsive layout
- ✅ **Coordinación optimizada** — colores por tipo de OT desde DB, duración en grilla
- ✅ **Auditoría expandida** — coverage para Coordination (teams) y Fleet (vehicles)
- ✅ **Inventario optimizado** — categorías de productos desde DB, unificación concepto "Móvil"
- ✅ **Multi-entorno Frontend** — VITE_APP_ENV, Docker Compose develop/staging
- ✅ **Beholder Oracle migrado** — frontend integrado como carpeta normal
- ✅ **Módulo de Inventario** completo y funcional
- ✅ **Módulo de Coordinación** con sincronización en tiempo real
- ✅ **Módulo de Flota** con inspecciones diarias
- ✅ **Sistema de Auditoría Universal** (AuditLog)
- ✅ **Auth JWT** con Refresh Tokens y Rate Limiting
- ✅ **MinIO** — Migración de almacenamiento de archivos completada

**Próximo paso crítico:** Testing y debugging del flujo completo de OT

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
- Geolocalización: lat/lng en detail response, parse-map-link

### ✅ Coordinación (Scheduling)
- Grilla de tareas con granularidad de 15 minutos
- Sincronización automática (polling 5s, solo para hoy)
- Histórico de coordinación (sin polling para fechas pasadas)
- Drag & drop bidireccional
- Estados visuales y colores por **tipo de OT desde DB**
- Duración estimada visible en grilla
- Botón "Mostrar Ubicación" en CoordinationSheet
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
- **Categorías de productos desde DB** (Mayo 2026)
- **Unificación concepto "Móvil"** con VehicleSummary via JOIN (Mayo 2026)
- Stock movements con auditoría completa
- Transferencias BULK y SERIALIZED con wizard
- Integración con Work Orders (consumo de materiales)

### ✅ Dashboard (Refactorizado Mayo 2026)
- Datos reales desde API (sin mock data)
- Monitores de servicio en widget
- KPIs en tiempo real
- Optimización de queries

### ✅ Settings Module (Nuevo Mayo 2026)
- SystemConfig key-value (company_name, work_hours, etc.)
- ServiceMonitor CRUD desde UI
- Scheduled Tasks V2 configurables desde UI
- Sync execution history visualizable
- **Monitoring Engine**: Ping/HTTP/TCP/SSL checkers (Strategy Pattern)

### ✅ Auditoría Universal
- AuditLog centralizado (inserciones, updates, deletes)
- **Cobertura expandida**: Coordination (teams) + Fleet (vehicles) (Mayo 2026)
- **Date filters** con neon-calendar popover (Mayo 2026)
- Trazabilidad de cambios con usuario, timestamp, cambios_delta
- Vista de auditoría pública

### ✅ Beholder Oracle (Migrado Abril 2026)
- Frontend integrado como carpeta normal (sin submódulo)
- BeholderHistory UI para consultas históricas
- Parseo de sesiones PPPoE con ip_cliente y normalización de nodos

---

## 🗂️ Archivos Críticos

### Antes de tocar código:
1. [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) — Reglas estrictas de codificación
2. [`docs/ARQUITECTURA_TICKETS_V2.md`](ARQUITECTURA_TICKETS_V2.md) — Arquitectura modular
3. [`docs/MASTER_CONTEXT.md`](MASTER_CONTEXT.md) — Referencia completa del sistema
4. [`docs/INDICE_DOCUMENTACION_2026_06_02.md`](INDICE_DOCUMENTACION_2026_06_02.md) — Índice actualizado

### Para desarrollo:
5. `backend/src/models/` — Modelos SQLAlchemy
6. `backend/src/routers/settings.py` — Settings + Monitors + Scheduled Tasks
7. `backend/src/services/monitoring_engine.py` — Motor de monitoreo (814 líneas)
8. `frontend/src/pages/coordination/` — Grilla de coordinación
9. `frontend/src/pages/settings/` — Settings UI (MonitorsTab, ScheduledTasksTab)
10. `frontend/src/components/ui/ImageViewer.jsx` — Visor de imágenes

---

## 🐛 Bugs Corregidos (Post-Marzo 2026)

### Geolocalización (21 May 2026)
1. ✅ **Double /api/ prefix** en parse-map-link endpoint call
2. ✅ **goo.gl short links** no se resolvían (HTML body fallback)
3. ✅ **Pattern 3** de parse-map-link aceptaba separador opcional después de coma
4. ✅ **Botón 'Abrir ubicación'** siempre visible, gris cuando sin coordenadas
5. ✅ **'Extraer' → 'Validar'** con indicador checkmark/cross

### Sidebar (22 May 2026)
6. ✅ **Icon clipping** en sidebar collapsed
7. ✅ **Dashboard double-highlight**
8. ✅ **z-index** UpdateLocationModal sobre sidebar

### Coordinación (20 May 2026)
9. ✅ **URL duplicada** en workOrderTypes.service
10. ✅ **3 bugs** en coordinación + punto 5 optimizaciones

### Dashboard (25 May 2026)
11. ✅ **BASE_URL** corregido (remove duplicate /api prefix)
12. ✅ **API import path** corregido en dashboard.service.js

### Inventario (20 May 2026)
13. ✅ **Números de serie** restaurados en ProductCatalog
14. ✅ **Rendimiento** optimizado en módulo inventario/logística

---

## ⚡ Comandos Quick Start

### Ver estado de contenedores:
```bash
cd /opt/emerald-dev
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
```

### Levantar servicios (desarrollo):
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Levantar servicios (staging):
```bash
docker-compose -f docker-compose.staging.yml up -d
```

### Testear un endpoint:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8500/v2/work-orders/coordination/grid?start_date=2026-06-02&end_date=2026-06-02
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

---

## 🏭 Provisioning de Datos Semilla

Después de ejecutar migraciones Alembic en un entorno nuevo (staging/producción),
ejecutar el script de provisioning para crear datos base:

```bash
docker exec emerald_backend python scripts/provision_seed_data.py
```

Este script es **IDEMPOTENTE** y crea:
- **VIRTUAL warehouse** ("Equipos Instalados en Cliente") → para equipos serializados instalados
- **Tipos de OT** → install_ftth, install_aire, repair, pickup, infrastructure
- **Acciones de resolución (WO Actions)** → 15 acciones configurables por tipo de OT

> ⚠️ El VIRTUAL warehouse es obligatorio para el cierre de OTs con inventario.
> Sin él, el endpoint `POST /work-orders/{id}/complete` fallará con error 422.

---

## 📝 Próximas Tareas Prioritarias

1. 🔴 **MinIO**: Finalizar integración de almacenamiento S3-compatible para archivos
2. 🔴 **Performance**: Optimizar queries de coordinación para > 500 OTs
3. 🟡 **Validaciones**: Hardening de transiciones de estado en OT
4. 🟡 **Auditoría**: Expandir a EngineeringTasks y más entidades
5. 🟢 **GPS tracking**: Seguimiento en tiempo real de técnicos
6. 🟢 **Mobile App**: React Native para técnicos

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

### "Los monitores de servicio no funcionan"
1. Verifica que el backend tiene acceso de red a los destinos
2. Revisa `docker logs emerald_backend | grep -i monitor`
3. Los chequeos usan: Ping (ICMP), HTTP (HTTPS), TCP (socket), SSL (certificado)

### "Error al ejecutar tarea programada"
1. Verifica que Celery está corriendo: `docker ps | grep celery`
2. Revisa Redis: `docker ps | grep redis`
3. Los logs de ejecución están en Settings → Scheduled Tasks → Ver historial

---

## 📞 Contacto y Contexto

Para nueva sesión, menciona:
- **Estado actual**: Fase 5 (Geolocalización) completada. Settings + Monitoring operativos
- **Último commit**: `0c05a2b` (chore: wip minio)
- **Branch**: develop
- **WIP**: Integración MinIO para storage de archivos

**Prompt ideal para Copilot:**
```
Estoy en Emerald ERP (02 Jun 2026). Fase 5 completa: Geolocalización + Monitoring + Settings.
Últimas features: Dashboard real, Scheduled Tasks V2, Sidebar pin/collapse, Multi-entorno frontend.
WIP: MinIO file storage. ¿Qué quieres que trabaje?
```
