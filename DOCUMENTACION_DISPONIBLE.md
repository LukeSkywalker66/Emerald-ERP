# 📚 DOCUMENTACIÓN DISPONIBLE - Emerald ERP

## 🚀 INICIO RÁPIDO (LEER EN ESTE ORDEN)

### 1️⃣ Para Próxima Sesión - OBLIGATORIO
📄 **[LEER_PRIMERO_PROXIMA_SESION.md](LEER_PRIMERO_PROXIMA_SESION.md)**
- ⏱️ 2 minutos para entender qué hacer
- ✅ Validación inmediata del sistema
- 🚫 Reglas de oro (qué NO modificar)
- 📋 Checklist de acciones

### 2️⃣ Resumen Ejecutivo de Esta Sesión
📄 **[RESUMEN_SESION_2026-01-09.md](RESUMEN_SESION_2026-01-09.md)**
- 📊 Problema identificado y solución
- 🔄 Cambios técnicos (muy resumido)
- ✅ Status actual del sistema
- 🎯 Próximos pasos priorizados

### 3️⃣ Detalle Técnico Completo
📄 **[CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md](CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md)**
- 🏗️ Arquitectura y decisiones
- 💻 Código antes/después
- 🧪 Testing checklist
- 🔐 Reglas de oro técnicas

### 4️⃣ Estado Actual del Sistema
📄 **[ESTADO_ACTUAL_2026-01-09.md](ESTADO_ACTUAL_2026-01-09.md)**
- 📈 Features implementados
- 🔗 Integraciones activas
- 📊 Performance metrics
- 🎯 Próximos pasos

---

## 🗂️ DOCUMENTACIÓN POR TEMA

### 🎫 Sistema de Tickets (Multi-Flow)
- **Guía Rápida:** [RESUMEN_MULTI_FLOW_TICKETS.md](RESUMEN_MULTI_FLOW_TICKETS.md)
- **Detalle Técnico:** [docs/FLUJO_WIZARDS_ISPCUBE.md](docs/FLUJO_WIZARDS_ISPCUBE.md)
- **Arquitectura:** [docs/ARQUITECTURA_TICKETS_V2.md](docs/ARQUITECTURA_TICKETS_V2.md)

### 📋 Órdenes de Trabajo
- **Referencia:** [WORK_ORDER_EXECUTION_IMPLEMENTATION.md](WORK_ORDER_EXECUTION_IMPLEMENTATION.md)
- **Quick Start:** [WORK_ORDER_EXECUTION_QUICK_START.md](WORK_ORDER_EXECUTION_QUICK_START.md)

### 🔧 API
- **Referencia Completa:** [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- **Keys Management:** [docs/API_KEYS.md](docs/API_KEYS.md) / [IMPLEMENTACION_API_KEYS.md](IMPLEMENTACION_API_KEYS.md)

### 🚀 Deploy & Infraestructura
- **Quick Start:** [QUICK_START.md](QUICK_START.md)
- **Deployment:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Seguridad:** [docs/SEGURIDAD.md](docs/SEGURIDAD.md)

### 🏗️ Arquitectura General
- **Decisions Log:** [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)
- **Base de Datos:** [docs/BASE_DATOS.md](docs/BASE_DATOS.md)
- **Auth System:** [docs/AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md)

### 📊 Checkpoints Históricos
- **Índice:** [CHECKPOINTS_INDEX.md](CHECKPOINTS_INDEX.md)
- **Actual (09 Ene):** [CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md](CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md)
- **Anterior (08 Ene):** [CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md](CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md)
- **OT Cierre (07 Ene):** [CHECKPOINT_2026-01-07_OT_CIERRE.md](CHECKPOINT_2026-01-07_OT_CIERRE.md)
- **Sidebar (06 Ene):** [CHECKPOINT-2026-01-06.md](CHECKPOINT-2026-01-06.md)

---

## 🎯 DOCUMENTACIÓN POR PERSONA

### 👤 DESARROLLADOR BACKEND
1. Leer: `CHECKPOINT_2026-01-09_CONNECTION_DETAIL_RESTORE.md` → sección CODE_CHANGES_DETAIL
2. Revisar: `docs/ARQUITECTURA_TICKETS_V2.md`
3. Ver cambios: `git diff HEAD~2 backend/src/routers/tickets.py`
4. Validar: Tests en `test/test_wizards_e2e.py`

### 👤 DESARROLLADOR FRONTEND
1. Leer: `LEER_PRIMERO_PROXIMA_SESION.md`
2. Revisar: `RESUMEN_MULTI_FLOW_TICKETS.md`
3. Notar: **NO HAY CAMBIOS NECESARIOS** en UI (solo backend se actualizó)
4. Próximo: Implementar `InstallationWizard.jsx` → enviar ispcube_customer/connections

### 👤 DEVOPS / INFRAESTRUCTURA
1. Leer: `QUICK_START.md`
2. Ver: `DEPLOYMENT.md`
3. Logs: `docker compose logs -f backend`
4. Status: `curl http://localhost:8500/health`

### 👤 PROJECT MANAGER / STAKEHOLDER
1. Leer: `RESUMEN_SESION_2026-01-09.md` ← LO MÁS IMPORTANTE
2. Ver: `ROADMAP.md` → próximas features
3. Estado: `ESTADO_ACTUAL_2026-01-09.md`
4. Progress: `CHECKPOINTS_INDEX.md` → histórico de sesiones

---

## 🔗 REFERENCIAS RÁPIDAS

### URLs Útiles (Desarrollo Local)
- Backend API: http://localhost:8500
- Frontend: http://localhost:5173
- API Docs (Swagger): http://localhost:8500/docs
- Database: postgresql://user:pass@localhost:5432/emerald_stock

### Comandos Git Frecuentes
```bash
git branch -v                    # Ver rama actual
git log --oneline -10            # Ver últimos commits
git diff HEAD~1                  # Ver cambios del último commit
git pull origin develop          # Actualizar (antes de trabajar)
git push origin develop          # Subir cambios (después de revisar)
```

### Comandos Docker
```bash
docker compose ps                # Ver containers corriendo
docker compose logs -f backend   # Ver logs backend (real-time)
docker compose down && docker compose up -d  # Reiniciar todo
docker compose exec backend bash # Entrar a shell del backend
```

### Testing
```bash
python3 test/test_wizards_e2e.py  # Suite E2E de tickets
pytest backend/tests/ -v          # Unit tests (si existen)
```

---

## 📊 MAPA DE DOCUMENTACIÓN

```
📄 README.md                              ← INICIO
   ├─ LEER_PRIMERO_PROXIMA_SESION.md     ← PRÓXIMA SESIÓN
   ├─ RESUMEN_SESION_2026-01-09.md        ← RESUMEN EJECUTIVO
   ├─ ESTADO_ACTUAL_2026-01-09.md         ← STATUS SISTEMA
   │
   ├─ CHECKPOINTS/
   │  ├─ CHECKPOINT_2026-01-09_*.md       ← HOY
   │  ├─ CHECKPOINT_2026-01-08_*.md
   │  ├─ CHECKPOINT_2026-01-07_*.md
   │  └─ CHECKPOINTS_INDEX.md
   │
   ├─ FEATURES/
   │  ├─ RESUMEN_MULTI_FLOW_TICKETS.md
   │  ├─ WORK_ORDER_EXECUTION_*.md
   │  └─ docs/
   │     ├─ FLUJO_WIZARDS_ISPCUBE.md
   │     ├─ ARQUITECTURA_TICKETS_V2.md
   │     ├─ API_REFERENCE.md
   │     ├─ AUTH_SYSTEM.md
   │     └─ BASE_DATOS.md
   │
   ├─ DEPLOYMENT/
   │  ├─ QUICK_START.md
   │  ├─ DEPLOYMENT.md
   │  └─ SEGURIDAD.md
   │
   └─ ARCHITECTURE/
      ├─ ARCHITECTURE_DECISIONS.md
      └─ ROADMAP.md
```

---

## 🎓 FLUJOS DE LECTURA RECOMENDADOS

### 📚 Para entender EL SISTEMA COMPLETO
1. `README.md` (overview)
2. `QUICK_START.md` (setup)
3. `CHECKPOINTS_INDEX.md` (histórico)
4. `CHECKPOINT_2026-01-08_MULTI_FLOW_COMPLETE.md` (features)
5. `docs/ARQUITECTURA_TICKETS_V2.md` (detalle técnico)

### ⚡ Para CONTINUAR TRABAJO RÁPIDO
1. `LEER_PRIMERO_PROXIMA_SESION.md` (qué hacer ahora)
2. `RESUMEN_SESION_2026-01-09.md` (contexto últimas 2 horas)
3. El checkpoint correspondiente a la tarea

### 🚀 Para DEPLYAR A PRODUCCIÓN
1. `QUICK_START.md` (entender setup)
2. `docs/DEPLOYMENT.md` (instrucciones)
3. `docs/SEGURIDAD.md` (checklist de seguridad)
4. `docs/API_KEYS.md` (gestionar credenciales)

---

## ✅ CHECKLIST PARA NUEVA SESIÓN

- [ ] Leer `LEER_PRIMERO_PROXIMA_SESION.md`
- [ ] Validar sistema en navegador (2 min)
- [ ] Revisar `RESUMEN_SESION_2026-01-09.md`
- [ ] Leer checkpoint técnico si aplica
- [ ] `git pull origin develop` antes de modificar
- [ ] Consultar `CHECKPOINTS_INDEX.md` si estás perdido

---

**Última actualización:** 2026-01-09T14:20:00Z  
**Documentación sincronizada:** ✅ Sí  
**Todos los archivos linkeados:** ✅ Sí  
**Lista actualizada con commits recientes:** ✅ Sí
