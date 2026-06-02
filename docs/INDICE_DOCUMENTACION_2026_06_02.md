# 📚 Índice de Documentación - Emerald ERP (02 Junio 2026)

**Versión:** 3.0 (Reorganización Legacy)  
**Última actualización:** 02 de Junio 2026

---

## 🎯 Para Leer PRIMERO (por rol)

### 👨‍💻 Para Desarrolladores (Cualquier rol)
1. **[LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md)** ⭐ - Estado actual, bugs recientes, módulos aplicables
2. **[ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md)** - Detalle técnico y lista de tareas
3. **[AI_ARCHITECT_CONTEXT.md](AI_ARCHITECT_CONTEXT.md)** - Contexto arquitectónico para IAs/agentes
4. **[MASTER_CONTEXT.md](MASTER_CONTEXT.md)** - Referencia completa del sistema

### 🏢 Para Project Managers / Stakeholders
1. **[ROADMAP.md](ROADMAP.md)** - Plan de desarrollo Q1-Q4 2026
2. **[README.md](../README.md)** - Overview general del proyecto

### 🔧 Para DevOps / SRE
1. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deploy a staging/producción
2. **[DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md)** - Setup Docker Compose
3. **[ENTORNOS.md](ENTORNOS.md)** - Guía de entornos

---

## ✅ Documentación Vigente

### 🏗️ Arquitectura y Contexto
| Archivo | Descripción | Última Actualización |
|---------|-------------|---------------------|
| [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) | Estado actual del proyecto | 23 Mar 2026 |
| [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md) | Detalle técnico y bugs | 21 Mar 2026 |
| [MASTER_CONTEXT.md](MASTER_CONTEXT.md) | Referencia completa del sistema | 09 Mar 2026 |
| [AI_ARCHITECT_CONTEXT.md](AI_ARCHITECT_CONTEXT.md) | Contexto para IAs y agentes | 09 Mar 2026 |
| [_CRITICAL_DOCS_FOR_AI.md](_CRITICAL_DOCS_FOR_AI.md) | Documentación crítica para IA | 09 Mar 2026 |
| [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) | Decisiones técnicas | 06 Ene 2026 |

### 📦 Módulos Funcionales (Integradores)
| Archivo | Descripción | Líneas |
|---------|-------------|--------|
| [MODULO_INVENTARIO.md](MODULO_INVENTARIO.md) | Warehouse, Stock, Auditoría | 567 |
| [FLEET_MODULE.md](FLEET_MODULE.md) | Flota de vehículos operativos | 193 |
| [MODULO_ENGINEERING.md](MODULO_ENGINEERING.md) | Engineering/NOC tasks | 347 |
| [MODULO_SINCRONIZACION_NOCTURNA.md](MODULO_SINCRONIZACION_NOCTURNA.md) | Nightly sync con Celery | 536 |

### 🔐 Seguridad y Auth
| Archivo | Descripción |
|---------|-------------|
| [AUTH_SYSTEM.md](AUTH_SYSTEM.md) | JWT, Refresh Tokens, Rate Limiting |
| [SEGURIDAD.md](SEGURIDAD.md) | Checklist de seguridad, HTTPS, API Keys |
| [RBAC_MEJORA_ROLES.md](RBAC_MEJORA_ROLES.md) | Sistema de roles y permisos |

### 📊 Base de Datos
| Archivo | Descripción |
|---------|-------------|
| [BASE_DATOS.md](BASE_DATOS.md) | Esquema ERD, migraciones Alembic |
| [ARQUITECTURA_TICKETS_V2.md](ARQUITECTURA_TICKETS_V2.md) | Relaciones y eventos de tickets |

### 🌐 Integraciones
| Archivo | Descripción |
|---------|-------------|
| [INTEGRACIONES.md](INTEGRACIONES.md) | ISPCube, Mikrotik, SmartOLT |
| [ISPCUBE_API_REFERENCE.md](ISPCUBE_API_REFERENCE.md) | Referencia API de ISPCube |
| [API_REFERENCE.md](API_REFERENCE.md) | Referencia de API propia |
| [API_KEYS.md](API_KEYS.md) | Gestión de API Keys |
| [API_AGENT_EMERALD_LOCAL_DB_GUIDE.md](API_AGENT_EMERALD_LOCAL_DB_GUIDE.md) | Guía de agente local |

### 🚀 Deployment y DevOps
| Archivo | Descripción |
|---------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploy a staging/prod |
| [DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md) | Docker Compose setup |
| [ENTORNOS.md](ENTORNOS.md) | Guía de entornos |
| [PROXY.md](PROXY.md) | Configuración de proxy |
| [QUICK_START.md](QUICK_START.md) | Inicio rápido |

### 📋 Productos
| Archivo | Descripción |
|---------|-------------|
| [PRODUCT_CATALOG_CRUD_COMPLETE.md](PRODUCT_CATALOG_CRUD_COMPLETE.md) | CRUD completo de productos |
| [PRODUCT_CRUD_VISUAL_GUIDE.md](PRODUCT_CRUD_VISUAL_GUIDE.md) | Guía visual del CRUD |

### 🧪 Testing
| Archivo | Descripción |
|---------|-------------|
| [TEST_E2E_AUTOMATIZADAS_2026-03-12.md](TEST_E2E_AUTOMATIZADAS_2026-03-12.md) | Suite de tests E2E |
| [TEST_ENGINEERING_TIMELINE_E2E.md](TEST_ENGINEERING_TIMELINE_E2E.md) | Tests de engineering timeline |
| [TESTING_ENGINEERING.md](TESTING_ENGINEERING.md) | Testing del módulo engineering |

### 📈 Análisis y Auditoría
| Archivo | Descripción |
|---------|-------------|
| [ANALISIS_AUDITORIA.md](ANALISIS_AUDITORIA.md) | Análisis de auditoría |
| [ANALISIS_PERFORMANCE_INVENTARIO.md](ANALISIS_PERFORMANCE_INVENTARIO.md) | Performance de inventario |
| [AUDIT_RATE_LIMIT.md](AUDIT_RATE_LIMIT.md) | Rate limiting audit |

### 🧭 Otros
| Archivo | Descripción |
|---------|-------------|
| [ROADMAP.md](ROADMAP.md) | Plan Q1-Q4 2026 |
| [README.md](../README.md) | Overview del proyecto |
| [ORGANIZATION_SUMMARY.txt](ORGANIZATION_SUMMARY.txt) | Resumen organizacional |
| [FLUJO_WIZARDS_ISPCUBE.md](FLUJO_WIZARDS_ISPCUBE.md) | Flujo de wizards ISPCube |
| [Guia_despliegue_gitflow.md](Guia_despliegue_gitflow.md) | Guía de despliegue GitFlow |
| [Guía de Recuperación ante Desastres - Ecosistema Emerald.md](Guía%20de%20Recuperación%20ante%20Desastres%20-%20Ecosistema%20Emerald.md) | DRP |

---

## 🗑️ Documentación Archivada (Legacy)

Todo el contenido obsoleto se ha movido a **[docs/_legacy/](_legacy/)** y es ignorado por `.clineignore`.

| Ubicación en _legacy | Contenido | Cantidad |
|---------------------|-----------|----------|
| [checkpoints/](_legacy/checkpoints/) | Checkpoints históricos de sesiones (Ene-Feb 2026) | 25 |
| [archivos_obsoletos/](_legacy/archivos_obsoletos/) | Documentos previamente en _ARCHIVOS_OBSOLETOS | ~22 |
| [module_process/](_legacy/module_process/) | Docs de proceso de implementación (redundantes) | 26 |
| [session/](_legacy/session/) | Archivos de sesión de la raíz del proyecto | 15 |
| [adr/](_legacy/adr/) | Decisiones de arquitectura históricas | 3 |
| [changelog/](_legacy/changelog/) | Changelogs antiguos | 3 |
| [devops/](_legacy/devops/) | Reportes de testing antiguos | 2 |
| [inventario/](_legacy/inventario/) | Docs de proceso de inventario | 1 |
| [legacy/](_legacy/legacy/) | Docs previamente legacy | 1 |

> **Nota:** Si necesitas consultar algún archivo archivado, usa su ruta completa: `docs/_legacy/<categoria>/<archivo>`

---

## 📝 Cómo Mantener Esta Documentación

### ✅ Para mantener docs vigentes
1. Actualiza [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) con cambios relevantes
2. Documenta en el archivo temático correspondiente
3. Los módulos deben tener un solo documento integrador en `docs/`

### ✅ Para archivar documentación
1. Mueve el archivo a `docs/_legacy/module_process/` o la categoría correspondiente
2. El `.clineignore` lo ignora automáticamente

### ✅ Estructura recomendada
```
docs/
├── LEER_PRIMERO_ACTUAL.md      ← Entry point principal
├── MASTER_CONTEXT.md           ← Visión general
├── MODULO_*.md                 ← Un integrador por módulo
├── _CRITICAL_DOCS_FOR_AI.md    ← Contexto para IA
├── ... (demás docs vigentes)
└── _legacy/                    ← Ignorado por .clineignore
```
