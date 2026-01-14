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

⚠️ **LEER PRIMERO:** [LEER_PRIMERO_PROXIMA_SESION.md](LEER_PRIMERO_PROXIMA_SESION.md)

Incluye:
- Instrucciones de validación inmediata
- Reglas de oro (qué NO tocar)
- Troubleshooting rápido
- Próximos pasos sugeridos

---

## CHECKPOINT ACTIVO (Inventario + Work Orders)

📍 **[CHECKPOINT_2026-01-13_INVENTORY_WO_INTEGRATION.md](CHECKPOINT_2026-01-13_INVENTORY_WO_INTEGRATION.md)** ← ACTUAL
- Branch: `develop`
- Estado: 🔄 IN PROGRESS - Integración completada, pendiente validación en navegador
- Cambios: Integración real del inventario en WorkOrderExecutionPage, getMyWarehouse() implementado
- Próximos pasos: Aplicar cambios, validar visual, completar ProductCatalog UI/Transfers

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
