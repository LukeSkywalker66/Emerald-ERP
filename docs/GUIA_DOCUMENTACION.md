# 🧭 GUÍA DE DOCUMENTACIÓN - Emerald ERP

**Última actualización:** 13 de enero de 2026  
**Versión:** v2.1 (Módulo de Inventario - Fase 1 Completa)

---

## ⚡ Para Nueva Sesión de Copilot

### 1️⃣ **COMIENZA AQUÍ** (5 minutos)
👉 **[LEER_PRIMERO_PROXIMA_SESION.md](LEER_PRIMERO_PROXIMA_SESION.md)**
- Estado actual del sistema
- Build status y estado de containers
- Próximas acciones prioritarias
- Contexto de continuidad

### 2️⃣ **Luego Revisa el Índice** (2 minutos)
👉 **[CHECKPOINTS_INDEX.md](CHECKPOINTS_INDEX.md)**
- Mapa de sesiones y sus resultados
- Links a documentación específica
- Decisiones de arquitectura

### 3️⃣ **Si Necesitas Contexto Histórico**
👉 **[_ARCHIVOS_OBSOLETOS/README.md](_ARCHIVOS_OBSOLETOS/README.md)**
- Qué está archivado y por qué
- Cómo fueron las sesiones anteriores
- Features completadas (referencia)

---

## 📚 Documentación Técnica Vigente

### Arquitectura & Decisiones
| Archivo | Propósito |
|---------|-----------|
| [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) | Decisiones de diseño vigentes |
| [QUICK_START.md](QUICK_START.md) | Levantar proyecto localmente |
| [README.md](README.md) | Overview general del proyecto |

### Módulos del Sistema
| Módulo | Documentación |
|--------|---------------|
| **Inventario** (ACTIVO) | [docs/MODULO_INVENTARIO.md](docs/MODULO_INVENTARIO.md) |
| Inventario Frontend | [docs/PLAN_FRONTEND_INVENTARIO.md](docs/PLAN_FRONTEND_INVENTARIO.md) |
| Inventario Sprint 1 | [docs/SPRINT_1_FRONTEND_INVENTORY.md](docs/SPRINT_1_FRONTEND_INVENTORY.md) |
| Tickets | [docs/ARQUITECTURA_TICKETS_V2.md](docs/ARQUITECTURA_TICKETS_V2.md) |
| Auth | [docs/AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md) |

### API & Infraestructura
| Tema | Documentación |
|------|---------------|
| API Reference | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) ⭐ ACTUALIZADA |
| Base de Datos | [docs/BASE_DATOS.md](docs/BASE_DATOS.md) |
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Desarrollo Local | [docs/DESARROLLO_LOCAL.md](docs/DESARROLLO_LOCAL.md) |
| Entornos | [docs/ENTORNOS.md](docs/ENTORNOS.md) |

### Features Específicas
| Feature | Status | Documentación |
|---------|--------|---------------|
| Product CRUD | ✅ COMPLETO | [PRODUCT_CATALOG_CRUD_COMPLETE.md](PRODUCT_CATALOG_CRUD_COMPLETE.md) |
| Product CRUD Visual | ✅ COMPLETO | [PRODUCT_CRUD_VISUAL_GUIDE.md](PRODUCT_CRUD_VISUAL_GUIDE.md) |
| Product CRUD Summary | ✅ COMPLETO | [IMPLEMENTATION_SUMMARY_PRODUCT_CRUD.md](IMPLEMENTATION_SUMMARY_PRODUCT_CRUD.md) |

---

## 🔍 Busca Documentación por Caso de Uso

### "Necesito entender la estructura del proyecto"
1. Leer: [README.md](README.md)
2. Luego: [docs/BASE_DATOS.md](docs/BASE_DATOS.md)
3. Después: [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)

### "Voy a trabajar en Inventario"
1. Leer: [docs/MODULO_INVENTARIO.md](docs/MODULO_INVENTARIO.md)
2. Referencia: [docs/API_REFERENCE.md](docs/API_REFERENCE.md) (sección Inventory)
3. Si necesitas frontend: [docs/PLAN_FRONTEND_INVENTARIO.md](docs/PLAN_FRONTEND_INVENTARIO.md)

### "Necesito debuggear un endpoint"
1. Consulta: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
2. Luego: Backend code directamente (`backend/src/routers/`)
3. Logs: Ver DevTools o Docker logs

### "¿Cómo levanto el proyecto?"
1. Lee: [QUICK_START.md](QUICK_START.md)
2. O: [docs/DESARROLLO_LOCAL.md](docs/DESARROLLO_LOCAL.md)

### "Necesito contexto histórico de Tickets"
1. Lee: [docs/ARQUITECTURA_TICKETS_V2.md](docs/ARQUITECTURA_TICKETS_V2.md)
2. Luego: [docs/FEATURE_TIMELINE_LIVE_STATUS.md](docs/FEATURE_TIMELINE_LIVE_STATUS.md)

---

## 📊 Estado Actual del Sistema

### ✅ Completado
- [x] Módulo de Inventario Backend 100%
- [x] Product Catalog CRUD (Create, Read, Update, Delete)
- [x] Warehouse CRUD
- [x] Server-side filtering optimizado (NASA-level)
- [x] API Documentation actualizada
- [x] Database migrations

### 🔄 En Progreso
- [ ] Frontend de Inventario (Adjustments, Transfers, Stock tables)
- [ ] Testing end-to-end del módulo

### ⏳ Próximas Prioridades
Consulta [LEER_PRIMERO_PROXIMA_SESION.md](LEER_PRIMERO_PROXIMA_SESION.md) para el orden exacto.

---

## 🚨 Archivos Descontinuados

Los siguientes archivos han sido **ARCHIVADOS** en `_ARCHIVOS_OBSOLETOS/`:
- Checkpoints de sesiones cerradas (6-9 de enero)
- Resúmenes de sesiones históricas
- Documentación de features completadas (Work Orders, Sidebar)
- Scripts de test antiguos

**NO USES ESTOS ARCHIVOS.** Son solo histórico.

Si necesitas consultarlos por razones de auditoría: [_ARCHIVOS_OBSOLETOS/README.md](_ARCHIVOS_OBSOLETOS/README.md)

---

## 💡 Tips para Mantener Este Orden

1. **Al terminar sesión:** Actualiza `LEER_PRIMERO_PROXIMA_SESION.md`
2. **Documentación nueva:** Ponerla en raíz o en `/docs/` según aplique
3. **Features completadas:** Mover docs a `_ARCHIVOS_OBSOLETOS/` (con referencia en README)
4. **Cambios de arquitectura:** Actualizar `ARCHITECTURE_DECISIONS.md`

---

## 📞 Contacto / Soporte

- **Preguntas sobre arquitectura:** Ver `ARCHITECTURE_DECISIONS.md`
- **Bugs del sistema:** Ver logs en Docker: `docker compose logs -f backend`
- **Contexto perdido:** Revisar `CHECKPOINTS_INDEX.md`

---

**Última sesión productiva:** 13 de enero 2026  
**Sesión actual:** [Copilot Active]  
**Próxima acción:** Lee [LEER_PRIMERO_PROXIMA_SESION.md](LEER_PRIMERO_PROXIMA_SESION.md)

