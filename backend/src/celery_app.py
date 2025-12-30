from celery import Celery
from celery.schedules import crontab

# 1. Configuración de Celery
# Usamos Redis como Broker (cola de mensajes) y Backend (resultados)
celery_app = Celery(
    "emerald_tasks",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
    include=["src.jobs.sync"]  # <--- IMPORTANTE: Aquí registramos dónde están las tareas
)

# 2. Ajustes Regionales (Para que las 3 AM sean de Argentina, no de Londres)
celery_app.conf.update(
    timezone="America/Argentina/Buenos_Aires",
    enable_utc=True,
)

# 3. El Cronograma (Beat)
celery_app.conf.beat_schedule = {
    "sync-nocturno-diario": {
        "task": "src.jobs.sync.nightly_sync_task",  # Nombre exacto de la función decorada
        "schedule": crontab(hour=3, minute=0), # A las 3:00 AM
        
        # # ANTES: Solo a las 3 AM
        # # "schedule": crontab(hour=3, minute=0),
        # # AHORA: A las 3 AM y a las 12 (Mediodía)
        # "schedule": crontab(hour='3,12', minute=0),
    },
}