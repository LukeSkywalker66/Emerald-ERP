# 💎 Emerald ERP
Sistema de Gestión Integral para ISP (Internet Service Providers)

**Estado:** ✅ Production Ready  
**Última actualización:** 2 de marzo de 2026  
**Branch:** develop  
**Módulos Completos:** Autenticación, Tickets, Órdenes de Trabajo, Coordinación, Inventario, Ingeniería/NOC, **Fleet (vehículos)**

---

## 📚 **DOCUMENTACIÓN CONSOLIDADA** ⭐

### Para cualquier persona que necesite entender el proyecto:

1. **[⚡ EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)** ← Léeme primero (2 min)
   - Overview rápido del sistema
   - Responde FAQ
   - Perfect para arquitectos en apuro

2. **[🎭 MASTER_CONTEXT.md](MASTER_CONTEXT.md)** ← El documento completo (30 min)
   - Stack technológico detallado
   - Estructura del proyecto
   - Modelo de datos con relaciones
   - Módulos funcionales y su estado
   - Reglas de negocio
   - Patrones arquitectónicos

3. **[🤖 AI_ARCHITECT_CONTEXT.md](AI_ARCHITECT_CONTEXT.md)** ← Para IAs (Gemini, Claude)
   - Decisiones arquitectónicas clave
   - Troubleshooting matrix
   - Contribución guidelines
   - Deuda técnica

4. **[📖 DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** ← Índice de todo
   - Links a documentación específica por tema
   - Guía de lectura por perfil (arquitecto, dev, ops, qa)
   - Referencias cruzadas

5. **[🔄 AUTO_SYNC_CONTEXT_SETUP.md](docs/AUTO_SYNC_CONTEXT_SETUP.md)** ← Script automático
   - Cómo sincronizar docs a Google Drive
   - Setup de Rclone
   - Monitoreo y troubleshooting
   - Uso: `nohup ./auto_sync_context.sh > sync.log 2>&1 &`

---

## 📖 Descripción

Emerald ERP es una plataforma moderna diseñada para administrar la operación técnica y comercial de un ISP. Integra:
- ✅ Sistema multi-flujo de tickets (5 tipos: técnico, instalación, retiro, traslado, administrativo)
- ✅ **Motivos dinámicos por categoría** (cargados desde BD, sin hardcoding)
- ✅ Órdenes de trabajo con seguimiento técnico y coordinación
- ✅ Integración en tiempo real con ISPCube para búsqueda de clientes/conexiones
- ✅ Gestión de flota (vehículos operativos con almacenes móviles asociados)
- ✅ Gestión de inventario operativo (stock central + móvil en camionetas)
- ✅ Módulo de Ingeniería/NOC con kanban y timeline
- ✅ Coordinación de equipos (cuadrillas) con asignación de vehículos
- ✅ Historial de incidentes unificado (timeline)
- ✅ Caché optimizado para performance

El sistema está construido con una arquitectura modular contenerizada, utilizando FastAPI para un backend de alto rendimiento y React (Vite) para una experiencia de usuario fluida.

## 🚀 Stack Tecnológico

**Infraestructura:**
- Docker & Docker Compose
- Nginx + Let's Encrypt (SSL/TLS)

**Backend:**
- Python 3.11 + FastAPI + Uvicorn
- PostgreSQL 15 (Base de datos principal)
- SQLAlchemy 2.0 (ORM con Mapped types)
- Alembic (Migraciones)
- Celery + Redis (Tareas asíncronas y caché)

**Frontend:**
- React 19 + Vite
- Tailwind CSS 3 (Design System Emerald Dark Mode)
- React Router 7
- Lucide Icons

**Integraciones:**
- ISPCube API (CRM/Billing)
- Mikrotik RouterOS API (PPPoE)
- SmartOLT API (ONUs/Fibra)

## 📂 Estructura del Proyecto

```
emerald-erp/
├── backend/                          # API Principal (FastAPI + Celery)
│   ├── src/
│   │   ├── main.py                   # Entry point FastAPI
│   │   ├── celery_app.py             # Configuración Celery
│   │   ├── database.py               # Sesión PostgreSQL
│   │   ├── config.py                 # Variables de entorno
│   │   ├── models/                   # SQLAlchemy Models
│   │   │   ├── user.py               # Sistema de usuarios y roles
│   │   │   ├── tickets.py            # Tickets V2 (modular)
│   │   │   ├── audit.py              # Auditoría y rate limiting
│   │   │   └── ...
│   │   ├── schemas/                  # Pydantic Schemas (validación)
│   │   │   ├── tickets.py
│   │   │   ├── user_schemas.py
│   │   │   └── ...
│   │   ├── routers/                  # Endpoints API
│   │   │   ├── v1/                   # API V1 (auth)
│   │   │   │   └── auth.py
│   │   │   ├── tickets_v2.py         # Tickets V2 (reescrito)
│   │   │   ├── tags.py               # Sistema de etiquetas
│   │   │   └── search.py             # Búsqueda de conexiones
│   │   ├── services/                 # Lógica de negocio
│   │   │   ├── auth_service.py
│   │   │   ├── ticket_service.py
│   │   │   ├── audit_service.py
│   │   │   └── diagnosis.py          # Diagnóstico de red
│   │   ├── repositories/             # Acceso a datos
│   │   │   └── user_repository.py
│   │   ├── core/                     # Funcionalidades core
│   │   │   └── security.py           # JWT, hashing (Argon2)
│   │   ├── clients/                  # Clientes externos
│   │   │   ├── ispcube.py
│   │   │   ├── mikrotik.py
│   │   │   └── smartolt.py
│   │   ├── jobs/                     # Tareas Celery
│   │   │   └── sync.py               # Sincronización periódica
│   │   └── utils/
│   ├── alembic/                      # Migraciones
│   │   └── versions/                 # Historial de migraciones
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                         # Frontend Principal (React)
│   ├── src/
│   │   ├── pages/                    # Vistas principales
│   │   │   ├── LoginPage.jsx
│   │   │   ├── TicketsPage.jsx       # Lista de tickets
│   │   │   ├── TicketDetailPage.jsx  # Detalle de ticket (reescrito)
│   │   │   └── ...
│   │   ├── components/               # Componentes reutilizables
│   │   │   ├── ui/                   # Shadcn/UI components
│   │   │   │   ├── button.jsx
│   │   │   │   ├── dialog.jsx
│   │   │   │   ├── card.jsx
│   │   │   │   ├── command.jsx       # Nuevo
│   │   │   │   └── ...
│   │   │   └── tickets/              # Componentes específicos
│   │   │       ├── TicketHistoryCard.jsx
│   │   │       ├── RepeatedIssueAlert.jsx
│   │   │       └── TagsFilterPopover.jsx
│   │   ├── services/                 # API clients
│   │   │   └── tickets.service.js
│   │   ├── lib/
│   │   │   └── utils.js              # cn() helper
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── package.json
│   └── tailwind.config.js
│
├── beholder_frontend/                # Frontend de Diagnóstico (React)
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBox.tsx
│   │   │   ├── OutputBox.tsx
│   │   │   └── CopyButton.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
│
├── nginx/                            # Reverse Proxy
│   └── default.conf                  # Configuración de rutas
│
├── data/                             # Volúmenes persistentes
│   └── certbot/                      # Certificados SSL
│
├── docs/                             # Documentación técnica
│   ├── API_REFERENCE.md              # Referencia de API
│   ├── AUTH_SYSTEM.md                # Sistema de autenticación
│   ├── ARQUITECTURA_TICKETS_V2.md    # Arquitectura del módulo tickets
│   ├── BASE_DATOS.md                 # Esquema de base de datos
│   ├── DEPLOYMENT.md                 # Guía de deployment
│   ├── DESARROLLO_LOCAL.md           # Desarrollo local
│   ├── SEGURIDAD.md                  # Políticas de seguridad
│   ├── INTEGRACIONES.md              # APIs externas
│   ├── MANUAL_SYNC.md                # Sincronización manual
│   └── adr/                          # Architecture Decision Records
│       ├── 001-implementacion-ssl.md
│       ├── 003-background-jobs-celery.md
│       └── 004-ticketdetailpage-operador-ui.md
│
├── docker-compose.yml                # Orquestación de servicios
├── init-letsencrypt.sh               # Script SSL
├── CHECKPOINT_2026-01-05.md          # Último checkpoint de sesión
├── ARCHITECTURE_DECISIONS.md         # Decisiones arquitectónicas
├── ROADMAP.md                        # Roadmap del proyecto
└── README.md                         # Este archivo
```
│   ├── requirements.txt              # Dependencias Python
│   └── config/                       # Configuración local
│
├── beholder_frontend/                # Frontend de Monitoreo (React + Vite)
│   ├── src/
│   │   ├── components/               # Componentes React reutilizables
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── package.json
│   └── tailwind.config.js
│
├── frontend/                         # Frontend Principal (Legado - React + Vite)
│   ├── src/
│   │   └── components/
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
│
├── nginx/                            # Configuración del Reverse Proxy
│   └── default.conf                  # Rutas y proxy settings
│
├── data/                             # Volúmenes persistentes
│   └── certbot/                      # Certificados SSL Let's Encrypt
│       ├── conf/
│       └── www/
│
├── docs/                             # Documentación
│   ├── MANUAL_SYNC.md                # Guía de sincronización
│   └── adr/                          # Architecture Decision Records
│       └── 001-implementacion-ssl.md
│
├── test/                             # Tests
│   └── test.http
│
├── docker-compose.yml                # Orquestación de todos los servicios
├── init-letsencrypt.sh               # Script de inicialización SSL
├── preparar_contexto.py              # Script de preparación de contexto
├── README.md                         # Este archivo
├── ROADMAP.md                        # Plan futuro
└── README.md                         # Este archivo
```

## ⚡ Guía de Inicio Rápido (Local)

### 1. Requisitos

- Docker y Docker Compose instalados
- Git
- Archivo `.env` con variables de entorno

### 2. Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/LukeSkywalker66/Emerald-ERP.git
cd emerald-erp

# 2. Copiar el archivo de configuración
cp .env.example .env
# Editar .env con tus credenciales

# 3. Levantar la infraestructura
docker compose up --build -d

# 4. Verificar que todos los servicios estén corriendo
docker compose ps
```

### 3. Inicialización de Base de Datos

```bash
# Ejecutar migraciones
docker compose exec backend alembic upgrade head
```

### 4. Acceso a la Aplicación

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend Principal** | http://localhost:80 | Gestión de tickets y operaciones |
| **Beholder** | http://localhost:80/beholder | Diagnóstico de red |
| **API Docs** | http://localhost:8500/docs | Documentación interactiva FastAPI |
| **Backend API** | http://localhost:8500/api | Endpoints REST |

### 5. Servicios Docker

| Servicio | Imagen | Puerto | Propósito |
|----------|--------|--------|-----------|
| `db` | postgres:15-alpine | 5432 | Base de datos PostgreSQL |
| `backend` | emerald-erp-backend | 8500 | API REST FastAPI |
| `frontend` | emerald-erp-frontend | 5173 | Interfaz React principal |
| `beholder` | emerald-erp-beholder | 5173 | Dashboard diagnóstico |
| `nginx` | nginx:alpine | 80, 443 | Reverse proxy |
| `certbot` | certbot/certbot | - | Certificados SSL |
| `redis` | redis:alpine | 6379 | Cache y message broker |
| `celery_worker` | emerald-erp-backend | - | Tareas asíncronas |

### 6. Comandos Útiles

**Gestión de servicios:**
```bash
# Ver estado
docker compose ps

# Logs en tiempo real
docker compose logs -f backend
docker compose logs -f celery_worker
docker compose logs -f frontend

# Reiniciar servicios
docker compose restart backend
docker compose restart frontend
```

**Base de datos:**
```bash
# Acceso a PostgreSQL
docker compose exec db psql -U emerald_owner -d emerald_stock

# Backup
docker compose exec db pg_dump -U emerald_owner emerald_stock > backup.sql

# Migraciones
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "descripcion"
```

### Base de datos

```bash
# Crear una nueva migración tras cambios en models.py
docker-compose exec backend alembic revision --autogenerate -m "descripcion_cambio"
## 📚 Documentación

- **[Desarrollo Local](docs/DESARROLLO_LOCAL.md)** - Guía completa de desarrollo
- **[Deployment](docs/DEPLOYMENT.md)** - Despliegue en producción
- **[API Reference](docs/API_REFERENCE.md)** - Endpoints y contratos
- **[Base de Datos](docs/BASE_DATOS.md)** - Esquema y tablas
- **[Sistema de Autenticación](docs/AUTH_SYSTEM.md)** - JWT, roles y permisos
- **[Arquitectura Tickets V2](docs/ARQUITECTURA_TICKETS_V2.md)** - Módulo de tickets
- **[Seguridad](docs/SEGURIDAD.md)** - Políticas y mejores prácticas
- **[Integraciones](docs/INTEGRACIONES.md)** - ISPCube, Mikrotik, SmartOLT
- **[Manual de Sincronización](docs/MANUAL_SYNC.md)** - Sincronización de datos

## 🎯 Funcionalidades Principales

### Sistema de Tickets V2 (Reescrito)
- ✅ CRUD completo de tickets
- ✅ Estados: open, in_progress, pending, pending_infra, resolved, closed
- ✅ Prioridades: low, medium, high, critical
- ✅ Sistema de etiquetas (tags) con filtrado
- ✅ Órdenes de trabajo (WorkOrders): repair, install, pickup, infrastructure
- ✅ Timeline de eventos con auditoría completa
- ✅ Historial de tickets por conexión
- ✅ Detección de problemas recurrentes (<7 días)
- ✅ Campo availability_note (horarios de disponibilidad)
- ✅ Inline editing (estado, prioridad, asignado)
- ✅ Búsqueda por ID, asunto, cliente, DNI
- ✅ Detalles de conexión (cliente, plan, nodo, PPPoE)

### Sistema de Autenticación
- ✅ Login con JWT + Refresh Tokens
- ✅ Hashing de contraseñas con Argon2
- ✅ Sistema de roles y permisos
- ✅ Auditoría de acciones (audit_logs)
- ✅ Rate limiting por IP

### Diagnóstico de Red (Beholder)
- ✅ Búsqueda de clientes por username/IP/MAC
- ✅ Diagnóstico automático de conectividad
- ✅ Integración con Mikrotik, SmartOLT, ISPCube
- ✅ Historial de diagnósticos

### Integraciones
- ✅ ISPCube API (clientes, planes, facturación)
- ✅ Mikrotik RouterOS API (sesiones PPPoE)
- ✅ SmartOLT API (ONUs, potencia óptica)
- ✅ Sincronización periódica con Celery

## 🏗️ Arquitectura

### Backend (FastAPI)
```
┌─────────────────────────────────────┐
│         FastAPI Application         │
│  ┌─────────────────────────────┐   │
│  │   Routers (Endpoints)       │   │
│  │  - /api/v1/auth             │   │
│  │  - /api/v2/tickets          │   │
│  │  - /api/v2/tags             │   │
│  │  - /api/search              │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Services (Business Logic) │   │
│  │  - AuthService              │   │
│  │  - TicketService            │   │
│  │  - AuditService             │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Repositories (Data)       │   │
│  │  - UserRepository           │   │
│  │  - TicketRepository         │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Models (SQLAlchemy ORM)   │   │
│  │  - User, Role, AuditLog     │   │
│  │  - Ticket, WorkOrder        │   │
│  │  - Tag, Connection          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
           ↓
    PostgreSQL 15
```

### Frontend (React)
```
┌─────────────────────────────────────┐
│         React Application           │
│  ┌─────────────────────────────┐   │
│  │   Pages (Views)             │   │
│  │  - LoginPage                │   │
│  │  - TicketsPage              │   │
│  │  - TicketDetailPage         │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Components                │   │
│  │  - UI (Shadcn)              │   │
│  │  - Tickets                  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Services (API Clients)    │   │
│  │  - tickets.service.js       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## ⚙️ Variables de Entorno

Archivo `.env` principal:

```bash
# PostgreSQL
POSTGRES_USER=emerald_owner
POSTGRES_PASSWORD=<tu-password>
POSTGRES_DB=emerald_stock

# Backend
SECRET_KEY=<jwt-secret-key>
DATABASE_URL=postgresql://emerald_owner:<password>@db:5432/emerald_stock

# Celery + Redis
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Integraciones
ISPCUBE_API_URL=https://ispcube.example.com
ISPCUBE_API_KEY=<api-key>
MIKROTIK_HOST=192.168.1.1
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=<password>
SMARTOLT_API_URL=http://smartolt.example.com
SMARTOLT_API_KEY=<api-key>
```

## 🤝 Contribución

1. Fork el repositorio
2. Crear una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -m 'feat: agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es privado y propietario de 2F Internet.

## 👥 Equipo

Desarrollado por el equipo técnico de 2F Internet.

## 📞 Soporte

Para consultas técnicas o reporte de bugs, contactar al equipo de desarrollo.

---

**Última actualización:** 2026-01-06  
**Versión:** 2.0.0 (Tickets V2 + Tags + Historial)  
**Estado:** ✅ Producción
    ├─→ Procesamiento de tareas pesadas
    └─→ Redis (Message Broker)
```

### Sincronización de Datos

El sistema sincroniza información de múltiples fuentes externas mediante Celery:

- **ISPCube**: Clientes, conexiones, planes
- **Mikrotik**: Secretos PPP (usuarios), estado de conexiones
- **SmartOLT**: Suscriptores, ONUs, configuración de puertos

Los synchronizers en `backend/src/jobs/synchronizers/` implementan la lógica específica.

---

## 9. Troubleshooting

### El backend no conecta a PostgreSQL

```bash
# Verificar que el contenedor DB está healthy
docker-compose ps

# Ver logs de la DB
docker-compose logs db
```

### Celery no procesa tareas

```bash
# Verificar que Redis está corriendo
docker-compose logs redis

# Ver logs del worker
docker-compose logs -f celery_worker
```

### Frontend no carga correctamente

```bash
# Verificar configuración de Nginx
docker-compose logs nginx

# Verificar VITE_API_URL en .env
cat .env | grep VITE
```

---


## 🧪 Tests E2E Playwright (QA Dockerizado)

Para ejecutar los tests E2E de Kanban de forma aislada y segura:

1. Levanta el stack normalmente:
    ```bash
    docker compose up -d
    ```
2. Ejecuta los tests E2E en un contenedor sectorizado:
    ```bash
    docker compose -f docker-compose.yml -f frontend/tests/docker-compose.e2e.yml up --build e2e
    ```
    Esto solo corre los tests y apaga el contenedor al finalizar.

**Advertencias y buenas prácticas:**
- El servicio `e2e` y los helpers de test solo existen en entornos de QA/desarrollo.
- Nunca incluir el compose ni los scripts de E2E en despliegues productivos.
- Los helpers y credenciales de testing están sectorizados y documentados en `/frontend/tests`.
- Más info y ejemplos: [frontend/tests/README_DOCKER_E2E.md](frontend/tests/README_DOCKER_E2E.md)

---
## 10. Documentación Adicional

- [ROADMAP.md](ROADMAP.md) - Plan de desarrollo futuro
- [docs/MANUAL_SYNC.md](docs/MANUAL_SYNC.md) - Guía de sincronización manual
- [docs/adr/](docs/adr/) - Architecture Decision Records

---

## 📄 Licencia

[Especifica tu licencia aquí]

## 👥 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request


Nro de usuario de prueba: 20294562746