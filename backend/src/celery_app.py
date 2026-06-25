import logging

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

# 1. Configuración de Celery
# Usamos Redis como Broker (cola de mensajes) y Backend (resultados)
celery_app = Celery(
    "emerald_tasks",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
    include=[
        "src.jobs.sync",                      # Sync tasks
        "src.jobs.api_key_rotation",          # API Key rotation tasks
        "src.jobs.work_order_cleanup",        # Work Order auto-cleanup (NASA-grade)
        "src.jobs.monitoring",                # Internal monitoring engine (Strategy Pattern)
        "src.jobs.backup",                    # Backup automático de BD a Drive
    ]
)

# 2. Ajustes Regionales (Para que las 3 AM sean de Argentina, no de Londres)
celery_app.conf.update(
    timezone="America/Argentina/Buenos_Aires",
    enable_utc=True,
)

# 3. El Cronograma (Beat) — Schedule estático como fallback
# El schedule dinámico desde DB se aplica al final si está disponible.
STATIC_BEAT_SCHEDULE = {
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
    
    # ════════════════════════════════════════════════════════════════════════════════
    # 🤖 WORK ORDER AUTO-CLEANUP (NASA-GRADE CONSISTENCY)
    # ════════════════════════════════════════════════════════════════════════════════
    # Detecta OTs coordinadas que pasaron su fecha/hora sin iniciarse y las devuelve
    # automáticamente al backlog para reprogramación.
    # Grace period: 30 minutos después de la hora programada.
    # ════════════════════════════════════════════════════════════════════════════════
    "cleanup-abandoned-work-orders": {
        "task": "cleanup_abandoned_work_orders",
        "schedule": crontab(minute="*/30"),  # Cada 30 minutos
    },
    
    # ════════════════════════════════════════════════════════════════════════════════
    # 📡 MONITORING ENGINE — Periodic Health Checks
    # ════════════════════════════════════════════════════════════════════════════════
    # Ejecuta verificaciones periódicas de todos los monitores activos
    # (PING, HTTP, TCP, SSL) cuyo intervalo de check haya vencido.
    #
    # Frecuencia: cada 30 segundos para detectar cambios rápidamente.
    # Cada monitor tiene su propio check_interval_seconds configurable.
    # ════════════════════════════════════════════════════════════════════════════════
    "monitor-periodic-check": {
        "task": "monitoring.periodic_check",
        "schedule": crontab(minute="*/1"),  # Cada 1 minuto (cada monitor tiene su propio intervalo)
    },

    # ════════════════════════════════════════════════════════════════════════════════
    # 💾 BACKUP AUTOMÁTICO DE BASE DE DATOS
    # ════════════════════════════════════════════════════════════════════════════════
    # La tarea verifica is_enabled en la config de BD antes de ejecutarse.
    # Si is_enabled=False (default en no-prod), el backup se omite silenciosamente.
    # Para activar: Settings → Backup → habilitar.
    # Schedule default: 2:00 AM diario. Configurable desde UI.
    # ════════════════════════════════════════════════════════════════════════════════
    "backup-automatico-diario": {
        "task": "backup.run_scheduled",
        "schedule": crontab(hour=2, minute=0),  # 2:00 AM
        "kwargs": {"triggered_by": "scheduled"},
    },
}

celery_app.conf.beat_schedule = dict(STATIC_BEAT_SCHEDULE)


# 4. Schedule Dinámico desde DB (Scheduled Tasks V2)
# ────────────────────────────────────────────────────────────────
# Al iniciar, intenta leer la tabla scheduled_tasks y sobreescribe
# el beat_schedule estático con la configuración persistente.
# Si falla (DB no disponible, tabla no existe), mantiene el estático.


def build_beat_schedule_from_db() -> dict | None:
    """Construye beat_schedule dinámicamente desde la tabla ScheduledTask.

    Lee todas las tareas activas con cron_expression definido y construye
    un dict compatible con Celery Beat schedule.

    Returns:
        Dict con schedule dinámico, o None si no se pudo leer de DB.
    """
    try:
        from src.database import SessionLocal
        from src.models.scheduled_task import ScheduledTask

        db = SessionLocal()
        try:
            tasks = (
                db.query(ScheduledTask)
                .filter(
                    ScheduledTask.is_active == True,  # noqa: E712
                    ScheduledTask.cron_expression.isnot(None),
                )
                .all()
            )
        finally:
            db.close()

        if not tasks:
            logger.info("No hay tareas activas en DB para beat_schedule")
            return None

        schedule: dict = {}
        for task in tasks:
            if not task.cron_expression:
                continue

            parts = task.cron_expression.strip().split()
            if len(parts) != 5:
                logger.warning(
                    "Cron expression inválida para tarea '%s': %s",
                    task.task_name, task.cron_expression,
                )
                continue

            schedule[f"task-{task.id}-{task.task_name}"] = {
                "task": task.celery_task_path,
                "schedule": crontab(
                    minute=parts[0],
                    hour=parts[1],
                    day_of_month=parts[2],
                    month_of_year=parts[3],
                    day_of_week=parts[4],
                ),
            }

        logger.info(
            "Beat schedule dinámico construido desde DB: %d tareas activas",
            len(schedule),
        )
        return schedule

    except Exception as e:
        logger.warning(
            "No se pudo construir beat_schedule desde DB: %s. "
            "Usando schedule estático como fallback.",
            str(e),
        )
        return None


# Intentar aplicar schedule dinámico al cargar el módulo
_dynamic_schedule = build_beat_schedule_from_db()
if _dynamic_schedule:
    celery_app.conf.beat_schedule = _dynamic_schedule
    logger.info(
        "✅ Beat schedule dinámico aplicado: %d tarea(s) desde DB",
        len(_dynamic_schedule),
    )
else:
    logger.info("📋 Usando beat_schedule estático como fallback")
