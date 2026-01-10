# ÍNDICE DE CHECKPOINTS - Emerald ERP

**Propósito:** Mapeo rápido de sesiones AI-to-AI para continuidad de trabajo.

---

## 📬 MENSAJE URGENTE PARA PRÓXIMA SESIÓN

⚠️ **LEER PRIMERO:** [LEER_PRIMERO_PROXIMA_SESION.md](LEER_PRIMERO_PROXIMA_SESION.md)

Este archivo contiene:
- ✅ Instrucciones de validación inmediata (2 min)
- ✅ Reglas de oro (qué NO modificar)
- ✅ Troubleshooting rápido
- ✅ Próximos pasos sugeridos

---

## CHECKPOINT ACTIVO

📍 **[CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md](CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md)** ← ACTUAL
- **Fecha:** 2026-01-09T14:00:00Z
- **Branch:** `develop` @ `3952daa`
- **Estado:** ✅ PRODUCTION_READY
- **Features:** Connection detail fix (fallback chain), client/history cards restored
- **Changes:** 1 archivo (backend/src/routers/tickets.py)
- **Migrations:** 0 (backward compatible)
- **Next:** Browser validation, wizard update for ispcube_customer payload

📍 **[CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md](CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md)** ← CONTEXTO
- **Fecha:** 2026-01-08T12:56:00Z
- **Branch:** `develop` @ `8d43282`
- **Estado:** ✅ PRODUCTION_READY
- **Features:** Multi-flow ticketing (5 tipos), API ISPCube, Cache optimizado
- **Tests:** 4/4 PASS
- **Performance:** 1200x mejora (21.7s → 0.018s)

---

## HISTÓRICO DE CHECKPOINTS (Más Reciente Primero)

### 2026-01-09 - Connection Detail UI Restoration
📄 [CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md](CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md)
- **Commit:** 3952daa
- **Features:** Fixed connection_id fallback en ticket detail
- **Estado:** ✅ PRODUCTION_READY
- **Cambios:** 1 file, connection_id_override param, effective_connection_id chain
- **Impacto:** Client/history cards ahora visibles para installation/relocation tickets

### 2026-01-08 - Multi-Flow Ticketing Complete
📄 [CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md](CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md)
- **Commit:** 8d43282
- **Features:** 5 flujos de tickets, ISPCube integration, cache, auto-OT
- **Estado:** Merged to develop

### 2026-01-07 - Sistema de Work Orders
📄 [CHECKPOINT_2026-01-07_OT_CIERRE.md](CHECKPOINT_2026-01-07_OT_CIERRE.md)
- **Commit:** 6d50016
- **Features:** Cierre de OTs, flujo completo execution, modalidad debug
- **Estado:** Merged to develop

### 2026-01-06 - Navegación y Sidebar
📄 [CHECKPOINT-2026-01-06.md](CHECKPOINT-2026-01-06.md)
- **Commit:** (ver archivo)
- **Features:** Refactoring sidebar, navegación optimizada
- **Estado:** Merged

### 2026-01-05 - Fundación del Sistema
📄 [CHECKPOINT_2026-01-05.md](CHECKPOINT_2026-01-05.md)
- **Commit:** (ver archivo)
- **Features:** Setup inicial, arquitectura base
- **Estado:** Foundation

---

## GUÍA DE USO PARA NEXT SESSION

### 1. Validar Estado Actual
```bash
cd /opt/emerald-erp
git checkout develop
git pull origin develop
git log --oneline -5
```

### 2. Verificar Sistema
```bash
docker compose ps
curl http://localhost:8500/health
python3 test/test_wizards_e2e.py
```

### 3. Leer Checkpoint Activo
```bash
cat CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md
```

### 4. Continuar Trabajo
- Revisar `NEXT_SESSION_PRIORITIES` en checkpoint
- Verificar `VALIDATION_CHECKLIST` antes de modificar
- Respetar `DANGEROUS_OPERATIONS` listadas
- Consultar `AI_DECISION_TREE` para decisiones comunes

---

## CONVENCIONES

### Formato de Checkpoint
- **Nombre:** `CHECKPOINT_YYYY-MM-DD_FEATURE_NAME.md`
- **Formato:** AI-to-AI optimized (no human-friendly requerido)
- **Secciones:** Metadata, State Machine, Filesystem Delta, Tests, Performance, etc.

### Cuándo Crear Nuevo Checkpoint
- Al completar una feature mayor
- Antes de merge a master
- Después de refactoring significativo
- Al final de sesión larga (>2 horas)

### Cuándo Actualizar Checkpoint Existente
- Fixes menores de bugs
- Actualizaciones de documentación
- Cambios de performance sin cambio de API

---

## QUICK LINKS

- [Resumen Ejecutivo Multi-Flow](RESUMEN_MULTI_FLOW_TICKETS.md)
- [Flujo de Datos ISPCube](docs/FLUJO_WIZARDS_ISPCUBE.md)
- [Tests E2E](test/test_wizards_e2e.py)
- [Roadmap General](ROADMAP.md)

---

**Última actualización:** 2026-01-08T12:56:00Z  
**Próxima revisión:** Cuando se complete nueva feature
