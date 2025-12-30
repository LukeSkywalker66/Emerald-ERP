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
    
    # ════════════════════════════════════════════════════════════
    # 🔐 API KEY ROTATION SCHEDULE
    # ════════════════════════════════════════════════════════════
    
    "api-keys-rotate-expiring": {
        "task": "api_keys.rotate_expiring",
        "schedule": crontab(hour=2, minute=0),  # Cada día a las 2:00 AM
        "kwargs": {}
    },
    
    "api-keys-cleanup-expired": {
        "task": "api_keys.cleanup_expired",
        "schedule": crontab(hour=3, minute=30),  # Cada día a las 3:30 AM
        "kwargs": {}
    },
    
    "api-keys-alert-expiring": {
        "task": "api_keys.alert_expiring",
        "schedule": crontab(hour=1, minute=0, day_of_week='0,3,6'),  # Cada 3 días a las 1:00 AM
        "kwargs": {"days_before": 30}
    },
    
    "api-keys-audit-report": {
        "task": "api_keys.generate_audit_report",
        "schedule": crontab(hour=4, minute=0, day_of_week=0),  # Domingos a las 4:00 AM
        "kwargs": {}
    },
}