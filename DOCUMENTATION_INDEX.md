# 📖 ÍNDICE DE DOCUMENTACIÓN CONSOLIDADA

**Emerald ERP - Centro de Referencia Técnica**

---

## 🎯 Para Arquitectos & Diseñadores

### 👉 **COMIENZA AQUÍ:**
- **[MASTER_CONTEXT.md](MASTER_CONTEXT.md)** ← **Documento único y completo**
  - Stack tecnológico completo
  - Estructura del proyecto simplificada
  - Modelo de datos (relaciones, enums)
  - Módulos funcionales (estado, features)
  - Reglas de negocio clave
  - Patrones arquitectónicos
  - Ejemplos de código

**Lectura estimada:** 20-30 minutos para entender el sistema completo.

---

## 🔧 Para Desarrolladores

### Setup & Desarrollo Local
1. [QUICK_START.md](docs/QUICK_START.md) - Inicio rápido (5 min)
2. [DESARROLLO_LOCAL.md](docs/DESARROLLO_LOCAL.md) - Setup detallado
3. [README.md](README.md) - Overview general

### Backend (Python + FastAPI)
- [AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md) - JWT, API Keys, Roles
- [BASE_DATOS.md](docs/BASE_DATOS.md) - Schema PostgreSQL detallado
- [API_REFERENCE.md](docs/API_REFERENCE.md) - Endpoints documentados

### Frontend (React + Vite)
- [PLAN_FRONTEND_INVENTARIO.md](docs/PLAN_FRONTEND_INVENTARIO.md) - UI patterns
- [IMPLEMENTATION_SUMMARY_PRODUCT_CRUD.md](docs/IMPLEMENTATION_SUMMARY_PRODUCT_CRUD.md) - Example CRUD

### Testing
- [frontend/tests/README.md](frontend/tests/README.md) - E2E Playwright setup

---

## 📦 Módulos en Detalle

### Tickets (Soporte Técnico)
- [docs/ARQUITECTURA_TICKETS_V2.md](docs/ARQUITECTURA_TICKETS_V2.md) - Flujos multi-tipo
- [FEATURE_TIMELINE_LIVE_STATUS.md](docs/FEATURE_TIMELINE_LIVE_STATUS.md) - Timeline unificada

### Inventario
- [docs/MODULO_INVENTARIO.md](docs/MODULO_INVENTARIO.md) - Stock, movimientos, seriales

### Work Orders
- [docs/_ARCHIVOS_OBSOLETOS/WORK_ORDER_EXECUTION_IMPLEMENTATION.md](docs/_ARCHIVOS_OBSOLETOS/WORK_ORDER_EXECUTION_IMPLEMENTATION.md) - Ejecución móvil

### Ingeniería/NOC
- [docs/CHECKPOINT_16ENE2026_ENGINEERING_COMPLETE.md](docs/checkpoints/CHECKPOINT_16ENE2026_ENGINEERING_COMPLETE.md) - Kanban, tasks, timeline

---

## 🚀 Deployment & DevOps

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deploy a producción
- [docs/ENTORNOS.md](docs/ENTORNOS.md) - Configuración por ambiente
- [docker-compose.yml](docker-compose.yml) - Orquestación Docker

---

## 📋 Decisiones Arquitectónicas (ADRs)

- [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) - Todas las decisiones clave
- [docs/adr/](docs/adr/) - ADRs individuales (si existen)

---

## 🔍 Checkpoints & Histórico

Documentación de cambios importantes por fecha:

- [CHECKPOINT_2026-01-29_E2E_TICKETS_WORKORDERS.md](CHECKPOINT_2026-01-29_E2E_TICKETS_WORKORDERS.md)
- [docs/checkpoints/CHECKPOINT_16ENE2026_ENGINEERING_COMPLETE.md](docs/checkpoints/CHECKPOINT_16ENE2026_ENGINEERING_COMPLETE.md)
- [docs/checkpoints/STATUS_IMPLEMENTACIONES_2026-01-14.md](docs/checkpoints/STATUS_IMPLEMENTACIONES_2026-01-14.md)
- [docs/CHECKPOINTS_INDEX.md](docs/CHECKPOINTS_INDEX.md) - Índice completo

---

## 🔐 Seguridad & Auditoría

- [docs/SEGURIDAD.md](docs/SEGURIDAD.md) - Práctica de seguridad
- [docs/AUDIT_RATE_LIMIT.md](docs/AUDIT_RATE_LIMIT.md) - Auditoría y rate limiting

---

## 🔌 Integraciones

- [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md) - ISPCube, Mikrotik, SmartOLT
- [docs/ISPCUBE_API_REFERENCE.md](docs/ISPCUBE_API_REFERENCE.md) - ISPCube API

---

## 🗺️ Roadmap

- [ROADMAP.md](docs/ROADMAP.md) - Plan futuro del proyecto
- [docs/FLUJO_WIZARDS_ISPCUBE.md](docs/FLUJO_WIZARDS_ISPCUBE.md) - Wizards planeados

---

## 📊 Mapas & Resúmenes Visuales

- [docs/ORGANIZATION_SUMMARY.txt](docs/ORGANIZATION_SUMMARY.txt) - Estructura texto
- [docs/GUIA_DOCUMENTACION.md](docs/GUIA_DOCUMENTACION.md) - Cómo escribir docs

---

## ❓ FAQ & Troubleshooting

### Errores Comunes

**Q: "404 on /api/v2/tickets"**
A: Ver [QUICK_START.md](docs/QUICK_START.md) → Sección "Proxy Setup"

**Q: "jwt decode error"**
A: JWT expirado, usar refresh token. Ver [AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md)

**Q: "CORS error"**
A: Revisar `VITE_API_URL` en `.env`. Ver docker-compose.yml línea 55.

---

## 📞 Contacto & Soporte

Para preguntas sobre arquitectura:
1. Consultar [MASTER_CONTEXT.md](MASTER_CONTEXT.md) (responde 90% de dudas)
2. Buscar en [docs/](docs/) el módulo relevante
3. Ver [ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) si es decisión diseño

---

## 🎓 Guía de Lectura Recomendada

### Por Perfil:

**Arquitecto:**
1. [MASTER_CONTEXT.md](MASTER_CONTEXT.md) (30 min)
2. [ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) (20 min)

**Backend Developer:**
1. [MASTER_CONTEXT.md](MASTER_CONTEXT.md) → Sección Backend (10 min)
2. [DESARROLLO_LOCAL.md](docs/DESARROLLO_LOCAL.md) (15 min)
3. [AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md) (10 min)
4. Código en `backend/src/` (explorar)

**Frontend Developer:**
1. [MASTER_CONTEXT.md](MASTER_CONTEXT.md) → Sección Frontend (10 min)
2. [DESARROLLO_LOCAL.md](docs/DESARROLLO_LOCAL.md) (15 min)
3. [PLAN_FRONTEND_INVENTARIO.md](docs/PLAN_FRONTEND_INVENTARIO.md) (10 min)
4. Código en `frontend/src/` (explorar)

**DevOps/Infrastructure:**
1. [DEPLOYMENT.md](docs/DEPLOYMENT.md) (20 min)
2. [ENTORNOS.md](docs/ENTORNOS.md) (10 min)
3. docker-compose.yml (explorar)

**QA/Testing:**
1. [MASTER_CONTEXT.md](MASTER_CONTEXT.md) → Sección Módulos (15 min)
2. [frontend/tests/README.md](frontend/tests/README.md) (10 min)

---

**Última actualización:** 30 de Enero 2026  
**Mantenedor:** GitHub Copilot (Arquitectura)
