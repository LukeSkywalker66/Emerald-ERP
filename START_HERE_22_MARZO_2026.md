# 🚀 START HERE - Emerald ERP (22 Marzo 2026)

**Para cualquier Copilot que continúe desde acá**

---

## ⚡ En 60 segundos

- **Proyecto:** Emerald ERP (Sistema de Gestión para ISP)
- **Stack:** FastAPI + React/Vite + PostgreSQL 15
- **Status:** Q1 ✅ Completado | Q2 🚧 Bug fixes en progreso
- **Última sesión:** 23 Mar 2026 (fixes de tooling TS + handoff actualizado)
- **Próxima acción:** [Ver tareas abajo](#-próximas-3-tareas-críticas)

---

## 📖 Lee ESTOS 3 archivos EN ORDEN (importante!)

1. **[docs/LEER_PRIMERO_ACTUAL.md](docs/LEER_PRIMERO_ACTUAL.md)** ← 5 min  
   *Estado actual del proyecto, módulos, quick commands.*

2. **[00_SESION_ACTUAL_23_MARZO_2026.md](00_SESION_ACTUAL_23_MARZO_2026.md)** ← 10 min  
   *Qué se hizo, bugs, commits. Incluye prompt sugerido.*

3. **[docs/INDICE_DOCUMENTACION_2026_03_21.md](docs/INDICE_DOCUMENTACION_2026_03_21.md)** ← Por consulta  
   *Master index: todos los docs catalogados por tema.*

---

## 🚦 Próximas 3 Tareas (CRÍTICAS)

### 1️⃣ 🔴 VALIDAR PERMISOS DE ROL "operador"
**Problema:** En frontend existen checks con `operator` (inglés), pero en BD hay rol `operador` (español).  
**Archivo:** `frontend/src/pages/WorkOrdersPage.jsx`  
**Acción:** Confirmar comportamiento real con usuario operador y decidir normalización robusta.  
**Tiempo:** 10 min | **Prioridad:** 🔴 ALTA

### 2️⃣ 🟡 QA SMOKE TEST: Coordinación
**Qué validar:**
- [ ] Abrir página de Coordinación
- [ ] Cambiar de fecha → datos persisten (NO flickering)
- [ ] Volver a hoy → polling resume
- [ ] Drag & drop en grilla (sin latidos visuales)

**Archivos modificados:** `CoordinationGridPage.jsx`, `useCoordinationSync.js`  
**Base de datos:** PostgreSQL running ✅  
**Tiempo:** 10 min | **Prioridad:** 🟡 MEDIA

### 3️⃣ 🟢 RELEASE READINESS: Proyectar Merge a Main
**Decisión:** ¿Mergeamos los bugs a main o esperamos más fixes?  
**Contexto:**
- ✅ 2 bugs corregidos (loading bar + polling)
- 🟡 1 bug pendiente (role normalization)
- ✅ Tests: npm build + lint limpio

**Tiempo:** 5 min (decisión) | **Prioridad:** 🟢 BAJA

---

## 🔧 Quick Commands

```bash
# Verificar estado actual
git log --oneline -5
git status

# Correr frontend
cd frontend && npm install && npm run dev

# Build
npm run build

# Lint
npm run lint

# Backend (si es necesario)
cd backend && source .venv/bin/activate && uvicorn src.main:app --reload

# Docker
docker-compose up -d
docker-compose ps
```

---

## 📊 Git Status Actual

```
Rama: develop (4 commits ahead of origin/develop)

9c725ac - docs: add START_HERE entry point for next Copilot session
c7400aa - docs: add final session status and handoff guide
f10cb02 - docs: consolidate documentation and add session summary
```

**Default branch:** `master`  
**Cambios pending:** revisar `git status` antes de continuar

---

## 🏗️ Arquitectura Rápida

| Componente | Ubicación | Estado |
|-----------|-----------|--------|
| **Backend** | `backend/src/` | ✅ FastAPI, SQLAlchemy 2.0 |
| **Frontend** | `frontend/src/` | ✅ React 19, Vite, Tailwind |
| **DB** | PostgreSQL 15 | ✅ 50+ tablas, migradas |
| **DevOps** | `docker-compose.yml` | ✅ Containerizado |
| **Docs** | `docs/` | ✅ Master index actualizado |

---

## ⚠️ Notas Importantes

1. **Reglas de Codificación:** Lee [.github/copilot-instructions.md](.github/copilot-instructions.md) ANTES de tocar código
2. **No hacks:** Somos nivel NASA; solo cambios quirúrgicos (ver principios en [00_SESION_ACTUAL_23_MARZO_2026.md](00_SESION_ACTUAL_23_MARZO_2026.md))
3. **Documentación:** Mantén actualizada; usar archivos del /docs/ como fuente de verdad
4. **Commits:** Mensajes en formato conventional (feat/fix/docs/etc.)

---

## 💡 Si estás perdido...

**¿Dónde está X?**
- Modelo de datos → `backend/src/models/*.py`
- Componente UI → `frontend/src/components/` o `frontend/src/pages/`
- Endpoint API → `backend/src/routers/*.py`
- Documentación → `docs/` o [00_SESION_ACTUAL_23_MARZO_2026.md](00_SESION_ACTUAL_23_MARZO_2026.md)

**¿Cómo hago Y?**
- Deploy → `docs/DEPLOYMENT.md`
- Setup local → `docs/DESARROLLO_LOCAL.md`
- Auth/Security → `docs/AUTH_SYSTEM.md`
- BD queries → `docs/BASE_DATOS.md`

---

## 📞 Para Retomar en la Próxima Sesión

Copia el siguiente template en el prompt de Copilot:

```
📍 Entrada desde START_HERE_22_MARZO_2026.md

Documentación base:
1. docs/LEER_PRIMERO_ACTUAL.md
2. 00_SESION_ACTUAL_23_MARZO_2026.md
3. docs/INDICE_DOCUMENTACION_2026_03_21.md

Última sesión: 23 Mar 2026
- ✅ Error de helpers/login.ts resuelto (tipos TS para tests)
- ✅ Error JSX en TicketTimeline corregido
- ✅ Typecheck local del frontend validado

Próximas tareas:
1. 🔴 Validar rol operador en WorkOrders (10 min)
2. 🟡 Smoke test coordinación (10 min)
3. 🟢 Decisión: merge a main? (5 min)

¿Por dónde empiezo?
```

---

**Estado: ✅ LISTO PARA CONTINUAR DESDE ACÁ**

🚀 Siguiente Copilot: ¡Bienvenido! Abrí [docs/LEER_PRIMERO_ACTUAL.md](docs/LEER_PRIMERO_ACTUAL.md) y continuá desde ahí.
