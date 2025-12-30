💎 Emerald ERP
Sistema de Gestión Integral para ISP (Internet Service Providers)

📖 Descripción

Emerald ERP es una plataforma moderna diseñada para administrar la operación técnica y comercial de un ISP. Integra la gestión de clientes, planes de servicio, tickets de soporte técnico y órdenes de trabajo en una sola interfaz unificada.

El sistema está construido con una arquitectura de microservicios contenerizados, utilizando FastAPI para un backend de alto rendimiento y React (Vite) para una experiencia de usuario fluida.

🚀 Stack Tecnológico

- Infraestructura: Docker & Docker Compose
- Base de Datos: PostgreSQL 15 (Persistencia)
- Backend: Python 3.11 + FastAPI + SQLAlchemy + Alembic
- Frontend: React 19 + Vite + Tailwind CSS
- Task Queue: Celery + Redis
- Reverse Proxy: Nginx + Let's Encrypt
- ORM: SQLAlchemy + Alembic Migrations

📂 Estructura del Proyecto

```
emerald-erp/
├── backend/                          # API Principal (FastAPI + Celery)
│   ├── src/
│   │   ├── main.py                   # Entry point de la API FastAPI
│   │   ├── celery_app.py             # Configuración de Celery
│   │   ├── models.py                 # Esquema de Base de Datos (ORM SQLAlchemy)
│   │   ├── database.py               # Configuración de conexión PostgreSQL
│   │   ├── config.py                 # Variables de configuración
│   │   ├── clients/                  # Clientes externos (ISPCube, Mikrotik, SmartOLT)
│   │   │   ├── ispcube.py
│   │   │   ├── mikrotik.py
│   │   │   └── smartolt.py
│   │   ├── db/                       # Utilidades de base de datos
│   │   │   └── postgres.py
│   │   ├── jobs/                     # Tareas Celery
│   │   │   ├── core.py
│   │   │   ├── sync.py               # Sincronización de datos
│   │   │   └── synchronizers/        # Lógica de sincronización por fuente
│   │   │       ├── ispcube_sync.py
│   │   │       ├── mikrotik_sync.py
│   │   │       └── smartolt_sync.py
│   │   ├── services/                 # Servicios de negocio
│   │   │   └── diagnosis.py
│   │   └── utils/                    # Utilidades
│   │       └── safe_call.py
│   ├── alembic/                      # Migraciones de base de datos
│   │   └── versions/                 # Historial de migraciones
│   ├── Dockerfile                    # Definición del contenedor Python
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
└── TODO_EL_PROYECTO.txt              # Tareas pendientes
```


⚡ Guía de Inicio Rápido (Local)

## 1. Requisitos

- Docker y Docker Compose instalados
- Git
- Archivo `.env` con variables de entorno (ver `.env.example`)

## 2. Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/LukeSkywalker66/Emerald-ERP.git
cd emerald-erp

# 2. Copiar el archivo de configuración
cp .env.example .env
# Editar .env con tus credenciales si es necesario

# 3. Levantar la infraestructura
docker-compose up --build -d

# 4. Verificar que todos los servicios estén corriendo
docker-compose ps
```

## 3. Inicialización de Datos

```bash
# Ejecutar migraciones y semillas
docker-compose exec backend alembic upgrade head
```

---

## 🌍 Entornos: Desarrollo, Preproducción y Producción

Emerald ERP corre en **3 entornos diferentes** con configuraciones distintas:

| Entorno | Estado | Documentación |
|---------|--------|--------------|
| **DESARROLLO** (Tu servidor local 138.59.172.26) | ✅ Activo | [ENTORNOS.md](./docs/ENTORNOS.md) |
| **PREPRODUCCIÓN** (Futuro, server 8GB) | 🔄 Planeado | [ENTORNOS.md](./docs/ENTORNOS.md) |
| **PRODUCCIÓN** (Futuro, servidor en vivo) | ⏳ Futuro | [ENTORNOS.md](./docs/ENTORNOS.md) |

**Lee [ENTORNOS.md](./docs/ENTORNOS.md)** para entender:
- Cómo funcionan los diferentes `.env` por entorno
- Cómo cambiar variables de configuración
- API Keys y su ciclo de vida por entorno
- Flujo de cambios: dev → preprod → prod
- Timezones y logs (ahora sincronizados con hora local)

---

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| **Frontend** | http://localhost:80 | N/A |
| **Beholder (Monitor)** | http://localhost:80/beholder | N/A |
| **API Backend** | http://localhost:80/api | N/A |
| **Documentación API** | http://localhost:80/api/docs | N/A |
| **Redis** | localhost:6379 (interno) | N/A |

## 5. Servicios en Docker Compose

| Servicio | Imagen | Propósito |
|----------|--------|----------|
| `db` | postgres:15-alpine | Base de datos PostgreSQL |
| `backend` | Custom (FastAPI) | API REST principal |
| `frontend` | Custom (React/Vite) | Interfaz principal |
| `beholder` | Custom (React/Vite) | Dashboard de monitoreo |
| `nginx` | nginx:alpine | Reverse proxy y balanceo |
| `certbot` | certbot/certbot | Renovación automática SSL |
| `redis` | redis:alpine | Message broker para Celery |
| `celery_worker` | Custom (Python) | Worker para tareas asincrónicas |

## 6. Comandos Útiles

### Gestión de servicios

```bash
# Ver estado de todos los servicios
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f backend        # Logs del backend
docker-compose logs -f celery_worker  # Logs de tareas asincrónicas
docker-compose logs -f nginx          # Logs del reverse proxy

# Reiniciar un servicio específico
docker-compose restart backend
```

### Base de datos

```bash
# Crear una nueva migración tras cambios en models.py
docker-compose exec backend alembic revision --autogenerate -m "descripcion_cambio"

# Aplicar migraciones
docker-compose exec backend alembic upgrade head

# Ver historial de migraciones
docker-compose exec backend alembic history
```

### Desarrollo

```bash
# Ejecutar comandos en el backend
docker-compose exec backend python -c "import src.models"

# Acceder a la shell de PostgreSQL
docker-compose exec db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}
```

### Limpieza y reset

```bash
# Detener todos los servicios
docker-compose down

# Eliminar volúmenes (⚠️ Borra BD)
docker-compose down -v

# Reconstruir y levantar desde cero
docker-compose up --build -d
```

---

## 7. Variables de Entorno

El proyecto utiliza un archivo `.env` para configurar los servicios. Variables principales:

```bash
# PostgreSQL
POSTGRES_USER=admin
POSTGRES_PASSWORD=adminpassword
POSTGRES_DB=emerald

# Frontend
VITE_API_URL=/api           # URL base para la API desde el frontend
CHOKIDAR_USEPOLLING=true    # Polling para Hot Module Reload en Docker

# Beholder (Monitor)
BEHOLDER_API_URL=/api       # URL de API para Beholder
BEHOLDER_API_KEY=optional   # Clave API si es requerida

# Celery + Redis
# Se configura automáticamente en docker-compose.yml
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

---

## 8. Arquitectura

### Flujo de Datos

```
Client (Navegador)
    ↓
Nginx (Reverse Proxy - Puerto 80/443)
    ├─→ /api → Backend FastAPI (5000)
    ├─→ / → Frontend React (3000)
    └─→ /beholder → Beholder UI (3001)

Backend API
    ├─→ PostgreSQL (DB)
    ├─→ Redis (Task Queue)
    └─→ External APIs (ISPCube, Mikrotik, SmartOLT)

Celery Workers
    ├─→ Sincronización de datos (sync.py)
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