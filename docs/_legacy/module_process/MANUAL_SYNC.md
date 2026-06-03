# ⚡ Sistema de Sincronización y Background Jobs

Emerald ERP utiliza **Celery + Redis** para manejar tareas pesadas fuera del ciclo de vida de la API HTTP.

## 🏗 Arquitectura
El sistema consta de tres componentes clave en `docker compose.yml`:
1.  **Redis (`emerald_redis`):** Actúa como la cola de mensajes. Recibe la orden "Sincronizar ahora" y la guarda.
2.  **Celery Beat (dentro del Worker):** Es el reloj. A las 3:00 AM (hora ARG), pone la orden en Redis.
3.  **Celery Worker (`emerald_worker`):** Es el obrero. Lee la orden de Redis y ejecuta el código Python.

## 📂 Ubicación del Código
* **Configuración:** `src/celery_app.py` (Define horarios y conexión a Redis).
* **Lógica de Negocio:** `src/jobs/nightly_sync.py` (Aquí está el script que baja la data).

## 🚀 Comandos Útiles

### Ver logs en tiempo real
Para ver si la sincronización está corriendo o si hubo errores:
```bash
docker compose logs -f celery_worker



docker compose exec backend python -c "from src.jobs.sync import nightly_sync_task; nightly_sync_task.delay()"