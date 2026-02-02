# 📚 Quick Reference - Documentación Base de Datos

**Última actualización:** 2 de febrero de 2026  
**Objetivo:** Acceso rápido a documentación de arquitectura de datos

---

## 🎯 Archivos Principales

### 📄 [docs/BASE_DATOS.md](docs/BASE_DATOS.md) - **ARCHIVO DEFINITIVO**
**Estado:** ✅ Actualizado 02/02/2026  
**Tamaño:** 420 líneas  
**Contenido:**
- Diagrama integral de entidades (visual)
- Enumeraciones completas (8 tipos)
- Relaciones y Foreign Keys
- Índices de performance
- Migraciones históricas
- 6 patrones de consulta listos para copiar
- Operaciones administrativas (backup, monitoreo)
- Patrón Clean Slate SQLAlchemy 2.0
- Seguridad y Soft Delete
- Caché y optimización

**Quién:** Arquitectos, Developers, DevOps
**Tiempo:** 15-20 min lectura completa | 2-3 min consulta puntual

---

### 📋 [ACTUALIZACION_BASE_DATOS_02_02_2026.md](ACTUALIZACION_BASE_DATOS_02_02_2026.md) - **RESUMEN EJECUTIVO**
**Estado:** ✅ Nuevo (02/02/2026)  
**Tamaño:** 287 líneas  
**Contenido:**
- Qué cambió vs versión anterior
- Cambios principales (Coordinación, Enums, Índices)
- Modelos actualizados (Team, TeamMember, WorkOrder)
- Transiciones de estado
- Usuarios beneficiados
- Decisiones arquitectónicas reflejadas
- Próximas acciones

**Quién:** Stakeholders, Leads, Equipos nuevos
**Tiempo:** 5-7 min

---

### 🏗️ [AI_ARCHITECT_CONTEXT.md](AI_ARCHITECT_CONTEXT.md)
**Estado:** ✅ Actualizado 02/02/2026  
**Contenido:**
- Misión del sistema
- 11 Decisiones Arquitectónicas (D1-D11)
- Patrones de diseño
- Service Layer
- SQLAlchemy 2.0 Mapped Types
- Teams vs Usuarios

**Para:** GeminiAI, arquitectos, diseño de nuevas features

---

### 🔧 [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md)
**Contenido:**
- ADRs (Architecture Decision Records)
- Justificación de decisiones
- Alternativas consideradas
- Impacto

---

## 🗂️ Cómo Navegar

### Si necesitas...

#### ✅ **Ver estructura de tablas**
→ [BASE_DATOS.md - Diagrama](docs/BASE_DATOS.md#-diagrama-de-entidades-integral)

#### ✅ **Entender estados de WorkOrder**
→ [BASE_DATOS.md - Enumeraciones](docs/BASE_DATOS.md#-enumeraciones-del-sistema)

#### ✅ **Saber qué cambió en Coordinación**
→ [ACTUALIZACION_BASE_DATOS_02_02_2026.md](ACTUALIZACION_BASE_DATOS_02_02_2026.md)

#### ✅ **Query de ejemplo: "Listar OT de un Team"**
→ [BASE_DATOS.md - Patrones](docs/BASE_DATOS.md#-patrones-de-consulta)

#### ✅ **Hacer backup de BD**
→ [BASE_DATOS.md - Backup](docs/BASE_DATOS.md#-operaciones-administrativas)

#### ✅ **Crear nueva migración**
→ [BASE_DATOS.md - Migraciones](docs/BASE_DATOS.md#-migraciones)

#### ✅ **Entender decisión D11 (Teams)**
→ [AI_ARCHITECT_CONTEXT.md - D11](AI_ARCHITECT_CONTEXT.md)

#### ✅ **Escribir un modelo correcto**
→ [BASE_DATOS.md - Clean Slate](docs/BASE_DATOS.md#-patrón-clean-slate-sqlalchemy-20)

---

## 📊 Comparativa de Documentos

| Aspecto | BASE_DATOS.md | Actualización | AI_ARCHITECT |
|--------|---|---|---|
| **Enfoque** | Técnico | Ejecutivo | Estratégico |
| **Audiencia** | Dev+DevOps | Leads+Stakeholders | Arquitectos |
| **Profundidad** | Máxima | Media | Media |
| **Ejemplos** | 6 queries | 3 diagramas | Conceptual |
| **Tamaño** | 420 líneas | 287 líneas | 700 líneas |
| **Actualizado** | 02/02/2026 | 02/02/2026 | 02/02/2026 |

---

## 🔄 Cambios Recientes (02/02/2026)

### ✅ Sistema de Coordinación
- New: `Team` + `TeamMember` tables
- New: `WorkOrder.team_id` (FK)
- New: `WorkOrder.scheduled_start/end` (datetime)
- New: `WorkOrder.estimated_duration` (int minutos)
- New: States: `coordinated`, `scheduled`
- New: Index: `(team_id, scheduled_start)`

### ✅ Documentación
- BASE_DATOS.md: Completo rewrite (568 → 420 líneas)
- Nuevo: ACTUALIZACION_BASE_DATOS_02_02_2026.md
- AI_ARCHITECT_CONTEXT.md: Updated D11

---

## 🚀 Próximas Acciones

### Inmediato (esta semana)
- [ ] Compartir [ACTUALIZACION_BASE_DATOS_02_02_2026.md](ACTUALIZACION_BASE_DATOS_02_02_2026.md) con team
- [ ] Validar en BD: `SELECT COUNT(*) FROM teams, team_members, work_orders`
- [ ] Verificar índices creados

### Corto plazo (2 semanas)
- [ ] Auditoría: Comparar docs vs modelos actuales
- [ ] Tests E2E: Coordinación (crear team → asignar OT → validar agenda)
- [ ] Documentar endpoints específicos en Swagger

### Mediano plazo (1 mes)
- [ ] UI de agenda (drag & drop)
- [ ] Capacitación al equipo (usar estos docs)
- [ ] Actualizar docstrings en models

---

## 📞 Referencia de Commits

| Commit | Mensaje | Archivos |
|--------|---------|----------|
| `b593106` | docs: resumen ejecutivo actualización BASE_DATOS.md | ACTUALIZACION_BASE_DATOS_02_02_2026.md |
| `b352f0e` | docs: actualizar BASE_DATOS.md con estructura completa | docs/BASE_DATOS.md |
| `7b7dfe8` | migration: merge heads coordinación | backend/alembic/versions/* |

---

## 🔐 Importante

**NUNCA editarBASE_DATOS.md sin:**
1. Verificar cambios en models (tickets.py, coordination.py)
2. Hacer backup de BD
3. Revisar migraciones aplicadas
4. Hacer commit con detalle de cambios
5. Actualizar ACTUALIZACION_*.md

**El documento es la Fuente de Verdad sobre schema.**

---

**Estado:** ✅ PRODUCCIÓN  
**Mantenedor:** GitHub Copilot + Equipo Dev
**Próxima revisión:** 2026-02-16
