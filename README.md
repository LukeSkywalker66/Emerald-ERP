💎 Emerald ERP
Sistema de Gestión Integral para ISP (Internet Service Providers)

📖 Descripción

Emerald ERP es una plataforma moderna diseñada para administrar la operación técnica y comercial de un ISP. Integra la gestión de clientes, planes de servicio, tickets de soporte técnico y órdenes de trabajo en una sola interfaz unificada.

El sistema está construido con una arquitectura de microservicios contenerizados, utilizando FastAPI para un backend de alto rendimiento y React (Vite) para una experiencia de usuario fluida.

🚀 Stack Tecnológico

- Infraestructura: Docker & Docker Compose
- Base de Datos: PostgreSQL 15 (Persistencia)
- Backend: Python 3.11 + FastAPI + SQLAlchemy + Alembic
- Frontend: React 19 + Vite + Bootstrap 

5📂 Estructura del Proyecto

emerald-erp/
├── backend/
│   ├── src/
│   │   ├── main.py          # Entry point de la API
│   │   ├── models.py        # Esquema de Base de Datos (ORM)
│   │   ├── database.py      # Configuración de conexión Postgres
│   │   ├── populate.py      # Script de semillas (Seed Data)
│   │   └── ...
│   ├── alembic/             # Migraciones de base de datos
│   ├── Dockerfile           # Definición del contenedor Python
│   └── requirements.txt     # Dependencias
├── frontend/
│   ├── src/                 # Código fuente React
│   ├── Dockerfile           # Definición del contenedor Node
│   └── package.json
├── docker-compose.yml       # Orquestación de servicios
└── README.md


⚡ Guía de Inicio Rápido (Local)

1. Requisitos

- Docker y Docker Compose instalados.
- Git.

2. InstalaciónBash# 
    1. Clonar el repositorio
    - git clone https://github.com/LukeSkywalker66/Emerald-ERP.git
    - cd emerald-erp

    # 2. Configurar variables de entorno (Opcional, docker-compose tiene defaults)
    # El sistema usará por defecto user: admin, pass: adminpassword

    # 3. Levantar la infraestructura
    - docker-compose up --build -d
    
3. Inicialización de Datos
Una vez que los contenedores estén corriendo, necesitamos crear las tablas y cargar datos de prueba.
Bash
# Ejecutar el script de población dentro del contenedor de backend
docker-compose exec backend python src/populate.py

4. Acceso al Sistema
Servicio            URL                                     LocalCredenciales (Demo)
Frontend (App)      http://localhost:4000                   N/A
Backend (API)       http://localhost:4001                   N/A
Documentación API   http://localhost:4001/docs              N/A
PgAdmin(DB)         http://localhost:4002                   admin@isp.com / admin

🛠 Comandos Útiles
Ver logs del backend:
Bash
docker-compose logs -f backend

Generar una nueva migración (tras cambios en models.py):
Bash
docker-compose exec backend alembic revision --autogenerate -m "descripcion_cambio"
docker-compose exec backend alembic upgrade head

Reiniciar todo desde cero (borrar BD):
Bash
docker-compose down -v
docker-compose up --build -d