# 🚀 Guía de Desarrollo Local

## Setup Inicial

### Requisitos

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- Git
- Visual Studio Code (recomendado)

### 1. Clonar y Preparar

```bash
# Clonar repositorio
git clone https://github.com/LukeSkywalker66/Emerald-ERP.git
cd emerald-erp

# Crear archivo .env de desarrollo
cp .env.example .env

# Editar con valores de desarrollo
nano .env
```

### 2. Levantar Infraestructura

```bash
# Construir imágenes Docker
docker compose build

# Levantar servicios
docker compose up -d

# Verificar que todo esté corriendo
docker compose ps
```

### 3. Ejecutar Migraciones

```bash
# Aplicar esquema de BD
docker compose exec backend alembic upgrade head

# Verificar
docker compose exec db psql -U admin -d emerald -c "\dt"
```

### 4. Probar Login (navegador)

- URL producción: https://emerald.2finternet.ar/login-test
- Credenciales pre-cargadas: `admin` / `Admin123` (correo: `admin@emerald.com`)
- Botones disponibles: "Ver Mi Perfil" (usa `/api/v1/auth/me`) y "Copiar Token".
- Ruta servida por Nginx con alias al archivo `nginx/login-test.html` montado vía `docker compose.yml`.
- Si actualizas el HTML, reinicia nginx: `docker compose restart nginx`.

---

## Desarrollo del Backend (FastAPI)

### Estructura

```
backend/
├── src/
│   ├── main.py              # Punto de entrada FastAPI
│   ├── models.py            # ORM SQLAlchemy
│   ├── database.py          # Configuración conexión
│   ├── config.py            # Variables de configuración
│   ├── celery_app.py        # Configuración Celery
│   ├── clients/             # Clientes externos
│   ├── db/                  # Queries customizadas
│   ├── jobs/                # Tareas asincrónicas
│   ├── services/            # Lógica de negocio
│   └── utils/               # Utilidades
├── alembic/                 # Migraciones
├── requirements.txt         # Dependencias
└── Dockerfile
```

### Hot Reload (Código en Vivo)

El backend corre en modo desarrollo con auto-reload:

```bash
# Ver logs con cambios en tiempo real
docker compose logs -f backend

# Editar un archivo y ver cambios instantáneamente
nano backend/src/main.py
# → FastAPI reinicia automáticamente
```

### Estructura de un Endpoint

```python
# En backend/src/main.py

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from src.database import get_db
from src import models

app = FastAPI()

# GET
@app.get("/api/clientes")
def get_clientes(db: Session = Depends(get_db)):
    """Obtener lista de clientes"""
    return db.query(models.Cliente).all()

# GET con parámetro
@app.get("/api/clientes/{cliente_id}")
def get_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Obtener cliente específico"""
    cliente = db.query(models.Cliente).get(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente

# POST
@app.post("/api/clientes")
def create_cliente(cliente_data: dict, db: Session = Depends(get_db)):
    """Crear nuevo cliente"""
    nuevo = models.Cliente(**cliente_data)
    db.add(nuevo)
    db.commit()
    return nuevo
```

### Agregar Nuevo Modelo

```python
# 1. Definir en backend/src/models.py
from sqlalchemy import Column, Integer, String
from src.database import Base

class Producto(Base):
    __tablename__ = "productos"
    
    id = Column(Integer, primary_key=True)
    nombre = Column(String(255), nullable=False)
    precio = Column(Integer)  # En centavos
    descripcion = Column(String(1000))

# 2. Generar migración
docker compose exec backend alembic revision --autogenerate \
  -m "agregar_tabla_productos"

# 3. Revisar y aplicar
docker compose exec backend alembic upgrade head

# 4. Usar en endpoint
@app.get("/api/productos")
def get_productos(db: Session = Depends(get_db)):
    return db.query(models.Producto).all()
```

### Testing Local

```bash
# Instalar pytest
pip install pytest pytest-asyncio

# Crear archivo de test
cat > backend/test_api.py << 'EOF'
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200

def test_get_clientes():
    response = client.get("/api/clientes")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
EOF

# Ejecutar tests
pytest backend/test_api.py -v
```

---

## Desarrollo del Frontend

### Estructura

```
frontend/
├── src/
│   ├── components/          # Componentes React reutilizables
│   ├── pages/               # Páginas principales
│   ├── App.jsx              # Componente raíz
│   ├── main.jsx             # Punto de entrada
│   └── index.css            # Estilos globales
├── public/                  # Assets estáticos
├── package.json
├── vite.config.js
└── Dockerfile
```

### Hot Module Replacement (HMR)

```bash
# Ya está configurado en docker compose.yml:
environment:
  - CHOKIDAR_USEPOLLING=true  # Enable HMR en Docker

# Editar un archivo:
nano frontend/src/App.jsx
# → Se recarga automáticamente en el navegador
```

### Estructura de Componente

```jsx
// frontend/src/components/ClienteCard.jsx

import React from 'react';
import './ClienteCard.css';

export const ClienteCard = ({ cliente, onDelete }) => {
  return (
    <div className="cliente-card">
      <h3>{cliente.name}</h3>
      <p>Email: {cliente.email}</p>
      <button onClick={() => onDelete(cliente.id)}>
        Eliminar
      </button>
    </div>
  );
};
```

### Usar en Página

```jsx
// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import { ClienteCard } from './components/ClienteCard';

function App() {
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    // Llamar API
    fetch('/api/clientes')
      .then(r => r.json())
      .then(data => setClientes(data));
  }, []);

  return (
    <div className="app">
      <h1>Clientes</h1>
      {clientes.map(cliente => (
        <ClienteCard key={cliente.id} cliente={cliente} />
      ))}
    </div>
  );
}

export default App;
```

### Instalar Dependencias Nuevas

```bash
# Agregar paquete
docker compose exec frontend npm install nombre-paquete

# Usar en componente
import { UnComponente } from 'nombre-paquete';
```

---

## Tareas Asincrónicas (Celery)

### Crear Nueva Tarea

```python
# backend/src/jobs/mi_tarea.py

from celery import shared_task
from src.config import logger

@shared_task(bind=True, max_retries=3)
def mi_tarea_pesada(self, parametro1, parametro2):
    """
    Tarea que se ejecuta en background.
    Si falla, reintentar hasta 3 veces.
    """
    try:
        logger.info(f"Ejecutando tarea con {parametro1}, {parametro2}")
        
        # Tu lógica aquí
        resultado = hacer_algo_pesado(parametro1, parametro2)
        
        logger.info("Tarea completada")
        return resultado
        
    except Exception as e:
        logger.error(f"Error en tarea: {e}")
        # Reintentar en 60 segundos
        raise self.retry(exc=e, countdown=60)
```

### Disparar Tarea desde Endpoint

```python
# backend/src/main.py

from src.jobs.mi_tarea import mi_tarea_pesada

@app.post("/api/procesar")
def procesar(datos: dict):
    """Disparar tarea en background"""
    
    # Ejecutar asincronamente
    task = mi_tarea_pesada.delay(datos['param1'], datos['param2'])
    
    return {
        "status": "Tarea en cola",
        "task_id": task.id
    }

# Obtener estado de la tarea
@app.get("/api/tarea/{task_id}")
def get_task_status(task_id: str):
    from src.celery_app import app as celery_app
    result = celery_app.AsyncResult(task_id)
    
    return {
        "state": result.state,
        "result": result.result if result.ready() else None
    }
```

### Tareas Programadas (Cron)

```python
# backend/src/celery_app.py

from celery import Celery
from celery.schedules import crontab

app = Celery('emerald')

app.conf.beat_schedule = {
    # Sincronización diaria a las 3 AM (Argentina)
    'sync-daily': {
        'task': 'src.jobs.sync.nightly_sync_task',
        'schedule': crontab(hour=3, minute=0),
    },
    
    # Cleanup cada domingo a las 2 AM
    'cleanup-weekly': {
        'task': 'src.jobs.cleanup.cleanup_old_logs',
        'schedule': crontab(day_of_week=0, hour=2, minute=0),
    },
}
```

---

## Debugging

### Print Debugging

```python
# backend/src/main.py

@app.get("/api/debug")
def debug_endpoint(db: Session = Depends(get_db)):
    print(f"🛑 DEBUG: Entrando a debug")  # Aparece en docker compose logs
    
    clientes = db.query(models.Cliente).all()
    print(f"🛑 DEBUG: Encontrados {len(clientes)} clientes")
    
    return {"count": len(clientes)}

# Ver output:
docker compose logs -f backend | grep "🛑"
```

### Debugger (pdb)

```python
# backend/src/main.py

import pdb

@app.get("/api/debug-pdb")
def debug_with_pdb(db: Session = Depends(get_db)):
    pdb.set_trace()  # Pausa aquí
    
    clientes = db.query(models.Cliente).all()
    return clientes

# En la terminal:
# docker compose exec backend bash
# curl http://localhost:5000/api/debug-pdb
# → Se abre el debugger interactivo en la terminal
```

### VS Code Debugging

```json
// .vscode/launch.json

{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend FastAPI",
      "type": "python",
      "request": "attach",
      "port": 5678,
      "host": "localhost",
      "pathMapping": {
        "/app": "${workspaceFolder}/backend"
      }
    }
  ]
}
```

```bash
# En Dockerfile de backend, asegurar que está debugpy
pip install debugpy
python -m debugpy --listen 0.0.0.0:5678 -m uvicorn src.main:app --reload
```

---

## Git Workflow

### Ramas

```bash
# Rama principal (producción)
git checkout master

# Rama de desarrollo
git checkout develop

# Rama de feature
git checkout -b feature/nueva-funcionalidad
```

### Commits

```bash
# Hacer cambios
nano backend/src/main.py

# Revisar cambios
git diff

# Commitear
git commit -am "feat: agregar endpoint de clientes"

# Push a rama feature
git push origin feature/nueva-funcionalidad

# Abrir Pull Request en GitHub
```

### Convención de Commits

```
feat: nueva funcionalidad
fix: corregir bug
docs: cambios en documentación
refactor: refactorizar código
test: agregar tests
chore: cambios en build, dependencies, etc
```

---

## Performance y Optimización

### Profiling de Requests

```python
# backend/src/main.py

import time

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    
    print(f"⏱️  {request.method} {request.url.path} - {duration:.2f}s")
    return response
```

### Análisis de Queries

```python
from sqlalchemy import event

@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, params, context, executemany):
    print(f"📊 SQL: {statement}")
    print(f"⏱️  Params: {params}")
```

