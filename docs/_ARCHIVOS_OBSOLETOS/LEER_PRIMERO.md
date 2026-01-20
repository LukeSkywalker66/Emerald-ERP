# 🚀 LEER PRIMERO - Emerald ERP

**Última actualización:** 13 de Enero 2026, 22:45 hs  
**Estado del proyecto:** Módulo Inventory COMPLETADO ✅

---

## 📋 Contexto Rápido (30 segundos)

Emerald ERP es un sistema de gestión para ISP en Argentina. Stack: **Python 3.11 (FastAPI) + React + Vite + PostgreSQL 15**.

**Acabamos de completar:**
- ✅ Módulo de Inventario completo (backend + frontend + UI)
- ✅ 8 vistas funcionales (Dashboard, Almacenes, Catálogo, Transferencias, Ajustes, Auditoría, Alertas)
- ✅ Sidebar rediseñado con navegación integrada
- ✅ Build sin errores (1818 módulos compilados)

**Próximo paso crítico:** Deploy a staging + Migraciones de base de datos

---

## 🎯 Prompt Ideal para Nueva Sesión

### Para GitHub Copilot:

```
Soy el asistente técnico senior de Emerald ERP (ISP en Argentina).

CONTEXTO ACTUAL (13 Ene 2026):
- Acabamos de completar el Módulo de Inventario (backend + frontend 100% funcional)
- 9 endpoints REST operativos (/api/inventory/*)
- 8 vistas React con diseño Art Deco Cyberpunk (Emerald/Zinc theme)
- Sidebar rediseñado con 6 items de Inventario
- Build exitoso: 1818 módulos, sin errores
- Branch: develop (pendiente merge a master)

ARQUITECTURA:
- Backend: FastAPI + SQLAlchemy 2.0 (usa Mapped[], mapped_column())
- Frontend: React + Vite + Tailwind + Shadcn UI
- DB: PostgreSQL 15 (JSONB para datos flexibles)
```