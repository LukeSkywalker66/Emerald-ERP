git checkout develop
git pull origin develop
git log --oneline -5
docker compose ps
# ÍNDICE DE CHECKPOINTS - Emerald ERP (docs/)

**Propósito:** Mapeo rápido de sesiones AI-to-AI para continuidad de trabajo.

---

## ⚠️ REORGANIZACIÓN (13-ENE-2026)

- Toda la documentación vive en `docs/`
- Históricos y sesiones cerradas están en `docs/_ARCHIVOS_OBSOLETOS/`
- Guía rápida: [GUIA_DOCUMENTACION.md](GUIA_DOCUMENTACION.md)

---

## 📬 MENSAJE URGENTE PARA PRÓXIMA SESIÓN


⚠️ **INICIO RÁPIDO:** Consulta la [GUÍA DE DOCUMENTACIÓN](GUIA_DOCUMENTACION.md) y el índice principal para instrucciones actualizadas y próximos pasos.

> **Nota:** Los archivos "LEER_PRIMERO" han sido archivados y solo deben consultarse para auditoría o contexto histórico.

---

## CHECKPOINT ACTIVO (RBAC + Work Orders)

📍 **[checkpoints/CHECKPOINT_2026-01-27_RBAC_FILTROS_WORK_ORDERS.md](checkpoints/CHECKPOINT_2026-01-27_RBAC_FILTROS_WORK_ORDERS.md)** ← ACTUAL
- Branch: `develop`
- Estado: ✅ COMPLETADO - Sistema de roles y filtrado de Work Orders funcional
- Cambios: 
  - Backend: Uso de get_current_user global, filtrado por rol "tecnico", JWT con campo role
  - Frontend: Extracción de role desde JWT, columnas condicionales, uso de technician_name
  - Documentación: Sistema modular de permisos propuesto (RBAC_MEJORA_ROLES.md)
- Próximos pasos: Decisión sobre migrar a sistema de permisos granulares o mantener actual

📍 **[CHECKPOINT_2026-01-13_INVENTORY_WO_INTEGRATION.md](CHECKPOINT_2026-01-13_INVENTORY_WO_INTEGRATION.md)** 
- Branch: `develop`
- Estado: ✅ COMPLETADO - Integración de inventario en Work Orders
- Cambios: Integración real del inventario en WorkOrderExecutionPage, getMyWarehouse() implementado

📍 **Session 2026-01-13 - Inventario / Product CRUD** (contexto previo)
- Estado: ✅ Backend inventario completo; Product CRUD (PUT/DELETE, type inmutable); server-side filtering
- Documentación asociada:
	- [PRODUCT_CATALOG_CRUD_COMPLETE.md](PRODUCT_CATALOG_CRUD_COMPLETE.md)
	- [PRODUCT_CRUD_VISUAL_GUIDE.md](PRODUCT_CRUD_VISUAL_GUIDE.md)
	- [IMPLEMENTATION_SUMMARY_PRODUCT_CRUD.md](IMPLEMENTATION_SUMMARY_PRODUCT_CRUD.md)

---

## HISTÓRICO (Archivado)

Checkpoint previos (6-9 enero) están en `docs/_ARCHIVOS_OBSOLETOS/` y se mantienen solo para auditoría.
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
