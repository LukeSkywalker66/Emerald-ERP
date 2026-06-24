# 🎯 Estado Actual del Proyecto - 02 Junio 2026

> Snapshot historico. Para estado vigente consultar `ESTADO_ACTUAL_2026_06_24.md`.

**Sesión:** Post-Fase 5 — Geolocalización, Monitoring Engine, Settings Module
**Último commit:** `0c05a2b` — chore: wip minio

---

## 📊 Resumen de Estado

| Componente | Estado | Última Actualización | Prioridad |
|-----------|--------|---------------------|-----------|
| **Backend (FastAPI)** | ✅ Estable | 02 Jun 2026 | OK |
| **Frontend (React/Vite)** | ✅ Estable | 02 Jun 2026 | OK |
| **Base de Datos (PostgreSQL)** | ✅ Healthy | 02 Jun 2026 | OK |
| **Autenticación (JWT+Rate Limit)** | ✅ Funcional | 25 May 2026 | OK |
| **Módulo Inventario** | ✅ Optimizado | 20 May 2026 | OK |
| **Módulo Coordinación** | ✅ Optimizado | 20 May 2026 | OK |
| **Módulo Flota** | ✅ Funcional | 25 May 2026 | OK |
| **Dashboard** | ✅ Refactorizado | 25 May 2026 | OK |
| **Settings Module** | ✅ Nuevo | 25 May 2026 | OK |
| **Monitoring Engine** | ✅ Nuevo | 25 May 2026 | OK |
| **Scheduled Tasks V2** | ✅ Nuevo | 25 May 2026 | OK |
| **Geolocalización** | ✅ Completo | 21 May 2026 | OK |
| **Sistema de Auditoría** | ✅ Expandido | 20 May 2026 | OK |
| **Beholder Oracle** | ✅ Migrado | 10 Abr 2026 | OK |
| **Multi-entorno** | ✅ Configurado | 29 May 2026 | OK |
| **MinIO Storage** | 🚧 WIP | 02 Jun 2026 | En desarrollo |
| **Docker Compose** | ✅ Healthy | 29 May 2026 | OK |

---

## 🚀 Implementaciones Recientes (Marzo - Junio 2026)

### 02 Jun 2026 — MinIO (WIP)
- Integración de almacenamiento S3-compatible para archivos/adjuntos
- Pendiente: migración de media existente, config de buckets

### 29-31 May 2026 — Multi-entorno + Limpieza
- `docker-compose.dev.yml` y `docker-compose.staging.yml` separados
- Nginx `default.conf` actualizado por entorno
- Proxy y certbot removidos de master/producción
- Beholder frontend: desanidado de submódulo, integrado como carpeta normal
- `VITE_APP_ENV` movido al `.env` raíz

### 25 May 2026 — Dashboard + Monitoring + Settings (Feature Set Grande)
- **Dashboard refactor**: eliminación completa de mock data, datos reales desde API
- **Monitoring Engine** (814 líneas): Strategy Pattern con PingChecker, HttpChecker, TcpChecker, SslChecker
  - Monitores de servicio con estados UP/DOWN/DEGRADED/UNKNOWN
  - CriticalityIndex (1-5): LOW a MISSION_CRITICAL
  - Historial de checks con resultados JSONB
- **Scheduled Tasks V2**: configuración persistente en DB, UI para activar/desactivar
  - Categorías: sync, maintenance, api_keys, general
  - Schedule configurable (cron expression)
  - Trigger manual + log de ejecuciones
- **Settings Module**: SystemConfig key-value, ServiceMonitor CRUD
  - SystemConfig: company_name, work_hours, logo_url, timezone
  - ServiceMonitor: HTTP/PING/TCP/SSL checks configurables desde UI

### 25 May 2026 — Blanqueo (Day-zero)
- Script de blanqueo para reset operacional día cero
- Evaluación arquitectónica del proceso

### 22 May 2026 — Sidebar Pin/Collapse
- Sidebar colapsable con hover-expand behavior
- Pin para fijar expandido
- Icon clipping corregido en collapsed state
- Dashboard double-highlight fix
- z-index stacking context para UpdateLocationModal
- Números de serie restaurados en ProductCatalog

### 21 May 2026 — Fase 5: Geolocalización
- **Campos lat/lng en WorkOrders**: migración + API response
- **parse-map-link**: extracción de coordenadas desde URLs de Google Maps
  - Soportados: goo.gl, /maps/place/, /maps/search/, /maps/@lat,lng
  - HTML body fallback para short links
  - Validación visual con indicador checkmark/cross
- **Botón 'Abrir ubicación'** en WorkOrder detail y CoordinationSheet
- **'Mostrar Ubicación'** en CoordinationSheet (coords del cliente)

### 20 May 2026 — Coordinación + Auditoría + Inventario
- **OT type colors desde DB**: colores por tipo de OT almacenados en `work_order_types`
- **Duración en grilla**: estimated_duration visible
- **Optimizaciones**: 3 bugs corregidos + rendimiento
- **Auditoría expandida**: coverage para Coordination (teams) y Fleet (vehicles)
- **Date filters**: neon-calendar popover reemplaza date inputs nativos
- **Inventario**: categorías de productos desde DB, unificación Móvil con VehicleSummary via JOIN
- **Rendimiento inventario**: optimización de queries

### 06 May 2026 — Source Maps Switch
- `VITE_ENABLE_SOURCEMAPS` env var para debug opcional
- Script `build:debug` en package.json

### 10 Abr 2026 — Beholder Oracle Migración
- Migración completa de Beholder Oráculo 2026
- Nuevos endpoints: `/api/v2/oraculo/pppoe` con ip_cliente y normalización de nodos
- BeholderHistory UI integrada
- Nightly sync: restaurado row counting + global error handling
- Unificación de Alembic heads

---

## 🏗️ Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React/Vite)                │
│  ┌──────┬───────┬──────────┬──────┬──────┬───────┬──────┐  │
│  │Login │Tickets│Inventory │Fleet │Coord │Settings│Behldr│  │
│  └──────┴───────┴──────────┴──────┴──────┴───────┴──────┘  │
│                           ↓↑ REST API (Bearer JWT)          │
└─────────────────────────────────────────────────────────────┘
               ↓↑
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI + Celery)                │
│  ┌──────┬───────┬──────────┬──────┬──────┬────────┬─────┐  │
│  │Auth  │Tickets│Inventory │Fleet │Coord │Settings│Audit│  │
│  │      │       │          │      │      │+Monitor│     │  │
│  └──────┴───────┴──────────┴──────┴──────┴────────┴─────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Celery Workers: nightly_sync, cleanup, api_keys     │   │
│  │  Scheduled Tasks V2: config desde DB                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓↑ SQLAlchemy 2.0                 │
└─────────────────────────────────────────────────────────────┘
               ↓↑
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL 15 (12+ tablas principales)          │
│    users | roles | tickets | work_orders | teams | vehicles │
│    warehouses | products | stock_* | audit_logs | monitors  │
│    scheduled_tasks | system_config | work_order_types       │
│    service_monitor | monitor_check_history                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Seguridad (Checklist)

- ✅ HTTPS con Let's Encrypt
- ✅ JWT + Refresh Tokens (15 min access, 7 days refresh)
- ✅ Rate Limiting de logins
- ✅ Audit Log de todas las operaciones (expandido a Coordination + Fleet)
- ✅ `.env` excluido de git
- ✅ Multi-entorno: secrets separados por entorno
- ⚠️ API Keys de ISPCube/Mikrotik en `.env` (requires protection)

---

## 📋 Datos de BD Relevantes

### Últimas migraciones Alembic ejecutadas:
- `2026_05_23_001_add_scheduled_tasks_table.py` — Scheduled Tasks V2
- `2026_05_23_002_add_schedule_config_column.py` — Schedule config
- `2026_05_23_003_add_monitor_check_history.py` — Monitor history
- `2026_05_21_001_add_lat_lng_to_connections_and_work_orders.py` — Geolocalización
- `2026_05_20_001_create_work_order_types_table.py` — Tipos de OT desde DB
- `2026_05_20_002_create_product_categories_table.py` — Categorías de producto

### Nuevos modelos desde Marzo:
- `ServiceMonitor` — Config de monitores de servicio
- `MonitorCheckHistory` — Historial de checks
- `ScheduledTask` — Tareas programadas persistentes
- `SystemConfig` — Configuración key-value
- `WorkOrderType` — Tipos de OT con color desde DB
- `ProductCategory` — Categorías de producto desde DB

---

## 🎯 Próximas Tareas (Prioridad)

### 🔴 Alta Prioridad
1. **MinIO**: Finalizar integración de almacenamiento de archivos
2. **Performance Coordinación**: Optimizar para > 500 OTs simultáneas

### 🟡 Media Prioridad
3. **Auditoría**: Expandir a EngineeringTasks, más entidades
4. **Validaciones OT**: Hardening de transiciones de estado
5. **GPS tracking**: Seguimiento en tiempo real de técnicos

### 🟢 Baja Prioridad
6. **Performance Frontend**: Code splitting y lazy loading
7. **Mobile App**: React Native para técnicos
8. **Internacionalización**: Soporte de idiomas

---

## 📞 Contacto para Próxima Sesión

Menciona en el prompt:
- **Fecha:** 02 Junio 2026
- **Último commit:** `0c05a2b` (chore: wip minio)
- **Cambios mayores:** Monitoring Engine, Scheduled Tasks V2, Settings Module, Geolocalización, Dashboard refactor, Multi-entorno
- **Bugs activos:** Ninguno conocido
- **WIP:** MinIO file storage
- **Next step:** Finalizar MinIO o elegir nueva feature
