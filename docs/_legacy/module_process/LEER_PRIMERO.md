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
- Design: Gradientes zinc, acentos emerald, iconos lucide-react
- Módulos: Auth ✅, Tickets ✅, Inventory ✅ (NUEVO), Beholder (legacy)

REGLAS ESTRICTAS:
1. SQLAlchemy 2.0 SIEMPRE (no usar Column() viejo)
2. PostgreSQL JSONB para datos flexibles
3. Seguridad: Argon2 para passwords, JWT + Refresh Tokens
4. Responder en ESPAÑOL (código puede tener comentarios en inglés)
5. NO modificar Beholder (legacy) sin permiso explícito
6. Respetar design system Emerald (ver .github/copilot-instructions.md)

ESTADO DE ARCHIVOS CRÍTICOS:
- frontend/src/components/AppSidebar.jsx: RECIÉN REDISEÑADO (no tocar sin razón)
- backend/src/routers/inventory.py: 9 endpoints operativos
- frontend/src/pages/inventory/*: 8 vistas completas
- App.jsx: 8 rutas de inventario activadas

TAREAS PENDIENTES PRIORITARIAS:
1. Crear migraciones Alembic para modelos Inventory
2. Deploy a staging para testing con datos reales
3. Documentar API endpoints en docs/API_REFERENCE.md
4. Implementar validaciones de permisos (roles granulares)

Lee CHECKPOINT_13ENE2026.md para detalles completos.

PREGUNTA INMEDIATA: ¿En qué quieres que trabaje ahora?
```

---

## 🗂️ Archivos Clave para Leer

### Antes de tocar código:
1. **`CHECKPOINT_13ENE2026.md`** → Estado completo del proyecto (ESTE ES EL MÁS IMPORTANTE)
2. **`.github/copilot-instructions.md`** → Reglas de codificación y design system
3. **`ROADMAP.md`** → Plan general del proyecto
4. **`docs/ARQUITECTURA_TICKETS_V2.md`** → Arquitectura modular (aplica a todos los módulos)

### Para continuar desarrollo:
5. **`backend/src/models/inventory.py`** → Modelos SQLAlchemy (revisar antes de migrations)
6. **`backend/src/services/inventory_service.py`** → Lógica de negocio (14 funciones)
7. **`frontend/src/services/inventory.service.js`** → Client API (14 funciones)
8. **`frontend/src/components/AppSidebar.jsx`** → Navegación principal (NO tocar sin razón)

---

## ⚡ Comandos Quick Start

### Ver estado de contenedores:
```bash
cd /opt/emerald-erp
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
```

### Levantar servicios:
```bash
docker-compose up -d
```

### Build frontend:
```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm run build
```

### Ver logs backend:
```bash
docker-compose logs -f emerald-backend
```

### Crear migration:
```bash
docker exec -it emerald-backend alembic revision --autogenerate -m "Add inventory tables"
docker exec -it emerald-backend alembic upgrade head
```

---

## 🎨 Design System Quick Reference

### Colores (Tailwind classes):
- **Fondos:** `bg-zinc-950`, `bg-zinc-900`, `bg-zinc-800`
- **Gradientes:** `from-zinc-950 to-zinc-900/80`
- **Emerald (primario):** `bg-emerald-500`, `text-emerald-400`, `border-emerald-500`
- **Alertas:** `bg-red-500` (crítico), `bg-amber-500` (warning), `bg-blue-500` (info)
- **Texto:** `text-zinc-100` (primario), `text-zinc-400` (secundario), `text-zinc-600` (hint)

### Componentes Shadcn UI usados:
- `Sidebar`, `Card`, `Button`, `Dialog`, `Tabs`, `Table`, `Badge`, `Input`, `Select`

### Iconos (lucide-react):
- Dashboard: `BarChart3`
- Almacenes: `Building2`
- Productos: `Package`
- Transferencias: `ArrowLeftRight`
- Auditoría: `ClipboardList`
- Alertas: `AlertCircle`

---

## 🚨 Advertencias Críticas

### ❌ NO HACER (sin aprobación explícita):
1. **NO eliminar o refactorizar Beholder** (módulo legacy en `src/db/postgres.py`)
2. **NO cambiar autenticación** (JWT + Refresh Tokens ya está probado)
3. **NO modificar AppSidebar.jsx** sin razón (recién rediseñado)
4. **NO usar Column()** de SQLAlchemy (usar `Mapped[]` y `mapped_column()`)
5. **NO exponer contraseñas** en logs o respuestas API

### ✅ HACER SIEMPRE:
1. **Leer CHECKPOINT_13ENE2026.md** antes de iniciar trabajo
2. **Verificar build** después de cambios en frontend (`npm run build`)
3. **Usar docker** para todo (no hay Node/npm local instalado)
4. **Respetar estructura modular** (repositories → services → routers)
5. **Documentar cambios** en archivos markdown apropiados

---

## 📞 Estructura del Proyecto

```
emerald-erp/
├── backend/
│   ├── alembic/              # Migraciones DB (PRÓXIMO PASO)
│   ├── src/
│   │   ├── models/           # SQLAlchemy 2.0 models
│   │   ├── repositories/     # Data access layer
│   │   ├── services/         # Business logic
│   │   ├── routers/          # API endpoints
│   │   ├── schemas/          # Pydantic validation
│   │   └── main.py           # FastAPI app
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── inventory/    # 8 vistas NUEVAS ✅
│   │   ├── components/
│   │   │   ├── AppSidebar.jsx  # REDISEÑADO ✅
│   │   │   └── inventory/      # 3 componentes auxiliares
│   │   ├── services/
│   │   │   └── inventory.service.js  # NUEVO ✅
│   │   └── App.jsx           # Rutas activadas ✅
│   └── package.json
│
├── docs/                     # Documentación técnica
├── .github/
│   └── copilot-instructions.md  # LEER SIEMPRE
├── CHECKPOINT_13ENE2026.md   # Estado actual (CRÍTICO)
├── LEER_PRIMERO.md          # Este archivo
└── ROADMAP.md               # Plan general
```

---

## 🎯 Flujo de Trabajo Recomendado

### 1. Al iniciar sesión:
```
1. Leer este archivo (LEER_PRIMERO.md)
2. Leer CHECKPOINT_13ENE2026.md
3. Verificar estado de contenedores: docker ps
4. Verificar branch: git branch (debería ser develop)
5. Preguntar al usuario: "¿En qué trabajamos hoy?"
```

### 2. Antes de codear:
```
1. Leer .github/copilot-instructions.md (reglas)
2. Revisar archivos existentes relacionados
3. Proponer plan de acción al usuario
4. Obtener aprobación antes de cambios grandes
```

### 3. Mientras codeas:
```
1. Hacer cambios incrementales
2. Verificar build después de cada cambio
3. Testear funcionalidad básica
4. Documentar decisiones importantes
```

### 4. Antes de terminar sesión:
```
1. Compilar frontend (npm run build)
2. Verificar que no hay errores
3. Commit + push de cambios
4. Actualizar CHECKPOINT (crear nuevo si es sesión larga)
5. Actualizar este archivo si cambia arquitectura
```

---

## 🔄 Git Workflow

```bash
# Ver estado
git status

# Ver rama actual
git branch

# Cambiar a develop (si no estás ahí)
git checkout develop

# Agregar cambios
git add .

# Commit descriptivo
git commit -m "feat(inventory): Complete module implementation

- Add 9 REST endpoints
- Implement 8 React views
- Redesign AppSidebar with Inventory section
- Add inventory service layer (14 functions)
- Build validated: 1818 modules compiled"

# Push a develop
git push origin develop

# Para merge a master (SOLO después de testing en staging)
git checkout master
git merge develop
git push origin master
```

---

## 🆘 Troubleshooting Rápido

### Frontend no compila:
```bash
# Verificar errores específicos
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm run build

# Si faltan dependencias
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine npm install

# Si problema con permisos
sudo chown -R $USER:$USER frontend/
```

### Backend no arranca:
```bash
# Ver logs
docker-compose logs emerald-backend

# Recrear contenedor
docker-compose up -d --force-recreate emerald-backend

# Entrar al contenedor
docker exec -it emerald-backend bash
```

### DB no responde:
```bash
# Verificar postgres
docker-compose logs emerald-postgres

# Recrear DB (CUIDADO: borra datos)
docker-compose down -v
docker-compose up -d
```

---

## 📚 Links Útiles

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **SQLAlchemy 2.0:** https://docs.sqlalchemy.org/en/20/
- **React Router v6:** https://reactrouter.com/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Shadcn UI:** https://ui.shadcn.com/
- **Lucide Icons:** https://lucide.dev/icons/

---

## 🎓 Onboarding para Nuevo Desarrollador

### Día 1: Familiarización
1. Leer este archivo (LEER_PRIMERO.md)
2. Leer CHECKPOINT_13ENE2026.md
3. Leer .github/copilot-instructions.md
4. Levantar proyecto local: `docker-compose up -d`
5. Explorar frontend: http://localhost:5173/app
6. Explorar API docs: http://localhost:8000/docs

### Día 2: Exploración de código
1. Revisar estructura backend: `backend/src/`
2. Revisar estructura frontend: `frontend/src/`
3. Entender flujo Auth: Login → JWT → Refresh Token
4. Entender flujo Tickets: Eventos, Estados, Timeline
5. Entender flujo Inventory: Stock BULK vs SERIALIZED

### Día 3: Primera tarea
1. Agregar campo simple a un modelo existente
2. Crear migration con Alembic
3. Actualizar schema Pydantic
4. Actualizar vista React
5. Testear cambio end-to-end

---

## ✨ Filosofía del Proyecto

### "The Emerald Orchestrator"
- **Concepto:** "Art Deco Cyberpunk" meets "Mago de Oz Tecnológico"
- **Rol del sistema:** Es "La Máquina detrás de la Cortina"
- **Tono de voz:** Misterioso pero profesional
- **Ejemplos de mensajes UI:**
  - "Consultando al Orquestador..."
  - "Acceso concedido"
  - "La Máquina está procesando..."
  - "Emerald supervisa tus operaciones"

### Clean Slate para nuevos módulos
- Módulos nuevos (como Inventory) usan arquitectura moderna
- Respetamos legacy (Beholder) sin refactorizar
- Migración progresiva conforme hay tiempo

---

**Última actualización:** 13 de Enero 2026, 22:45 hs  
**Mantenido por:** GitHub Copilot + Claude Sonnet 4.5  
**Próxima revisión:** Cada vez que se complete un módulo o hito importante

---

## 🎬 ¡Empecemos!

**Comando sugerido para GitHub Copilot al iniciar:**

> "Leí LEER_PRIMERO.md y CHECKPOINT_13ENE2026.md. El módulo Inventory está completo. ¿Trabajamos en las migraciones de Alembic para persistir los modelos, o prefieres que avance con otro módulo?"

**¡Buena suerte! 🚀**
