from celery import Celery
from celery.schedules import crontab

# 1. Configuración de Celery
# Usamos Redis como Broker (cola de mensajes) y Backend (resultados)
celery_app = Celery(
    "emerald_tasks",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
    include=[
        "src.jobs.sync",                # Sync tasks
        "src.jobs.api_key_rotation"     # API Key rotation tasks
    ]
)

# 2. Ajustes Regionales (Para que las 3 AM sean de Argentina, no de Londres)
celery_app.conf.update(
    timezone="America/Argentina/Buenos_Aires",
    enable_utc=True,
)

# 3. El Cronograma (Beat)
celery_app.conf.beat_schedule = {
    "sync-nocturno-diario": {
        "task": "src.jobs.sync.nightly_sync_task",
        "schedule": crontab(hour=3, minute=0),  # A las 3:00 AM
    },
    
    # ════════════════════════════════════════════════════════════════════════════════
    # 🔐 API KEY ROTATION SCHEDULE - COMENTADO (PENDIENTE DE IMPLEMENTACIÓN)
    # ════════════════════════════════════════════════════════════════════════════════
    # 
    # RAZÓN DEL COMENTARIO:
    # ====================
    # Las tablas 'api_keys' y 'api_key_audit' aún no existen en la BD porque:
    # 1. Se recreó el esquema public sin incluir las migraciones legacy
    # 2. Los modelos APIKey están en models/beholder.py (SQLAlchemy 1.x)
    #    pero NO están integrados en la nueva estructura de Alembic
    # 3. Las tareas fallan con: "module 'src.models' has no attribute 'APIKey'"
    #
    # PASOS PARA REACTIVAR:
    # ====================
    # 1. Crear migración Alembic para tablas legacy:
    #    $ docker compose exec backend alembic revision --autogenerate -m "add_api_keys_and_legacy_tables"
    #
    # 2. Revisar que la migración incluya:
    #    - api_keys (id, name, key_hash, key_prefix, expires_at, active, etc.)
    #    - api_key_audit (id, api_key_id, action, timestamp, etc.)
    #    - Modelos de Beholder legacy si es necesario (subscribers, nodes, plans, etc.)
    #
    # 3. Aplicar la migración:
    #    $ docker compose exec backend alembic upgrade head
    #
    # 4. Reactivar las tareas descomentando el bloque abajo
    #
    # 5. Reiniciar Celery Beat:
    #    $ docker compose restart celery_worker
    #
    # ════════════════════════════════════════════════════════════════════════════════
    
    # TAREAS COMENTADAS (Descomentar cuando APIKey esté disponible):
    # 
    # "api-keys-rotate-expiring": {
    #     "task": "api_keys.rotate_expiring",
    #     "schedule": crontab(hour=2, minute=0),  # Cada día a las 2:00 AM
    #     "kwargs": {}
    # },
    #
    # "api-keys-cleanup-expired": {
    #     "task": "api_keys.cleanup_expired",
    #     "schedule": crontab(hour=3, minute=30),  # Cada día a las 3:30 AM
    #     "kwargs": {}
    # },
    #
    # "api-keys-alert-expiring": {
    #     "task": "api_keys.alert_expiring",
    #     "schedule": crontab(hour=1, minute=0, day_of_week='0,3,6'),  # Cada 3 días a las 1:00 AM
    #     "kwargs": {"days_before": 30}
    # },
    #
    # "api-keys-audit-report": {
    #     "task": "api_keys.generate_audit_report",
    #     "schedule": crontab(hour=4, minute=0, day_of_week=0),  # Domingos a las 4:00 AM
    #     "kwargs": {}
    # },
}