"""
Monitoring Jobs — Tareas Celery para el Motor de Monitoreo Interno.

Ejecuta verificaciones periódicas de todos los monitores activos
cuyo intervalo de check haya vencido, utilizando el motor de
monitoreo (monitoring_engine.py) con Strategy Pattern.

Arquitectura:
    Celery Beat (cada 30s)
        ↳ monitor_periodic_check()
            ↳ MonitoringOrchestrator.run_due_checks(db)
                ↳ get_due_monitors()  → Lista de monitores vencidos
                ↳ run_check(monitor)  → Ejecuta checker apropiado
                    ↳ ServiceMonitorService.update_status()
                    ↳ ServiceMonitorService.record_check_history()
"""
from __future__ import annotations

import logging

from src.celery_app import celery_app
from src.models.settings import MonitorStatus

logger = logging.getLogger(__name__)


@celery_app.task(
    name="monitoring.periodic_check",
    bind=True,
    max_retries=3,
    default_retry_delay=10,  # Reintentar en 10s si falla
    acks_late=True,           # No perder tareas si el worker muere
)
def monitor_periodic_check(self) -> dict:
    """Tarea periódica: ejecuta verificaciones para monitores pendientes.

    Es llamada por Celery Beat cada 30 segundos. Revisa qué monitores
    activos tienen su intervalo de check vencido y ejecuta la verificación
    correspondiente para cada uno usando el motor de monitoreo.

    Returns:
        dict con estadísticas de la ejecución.
    """
    logger.info("[MONITORING] === Iniciando ronda de verificación periódica ===")

    try:
        from src.database import SessionLocal
        from src.services.monitoring_engine import MonitoringOrchestrator
        from src.services.settings_service import ServiceMonitorService

        db = SessionLocal()
        try:
            # Obtener monitores cuyo intervalo de check haya vencido
            due_monitors = MonitoringOrchestrator.get_due_monitors(db)

            if not due_monitors:
                logger.debug("[MONITORING] No hay monitores pendientes de verificación")
                return {
                    "status": "ok",
                    "checked": 0,
                    "monitors_due": 0,
                    "message": "No hay monitores pendientes",
                }

            logger.info(
                "[MONITORING] %d monitor(es) pendiente(s) de verificación",
                len(due_monitors),
            )

            stats = {
                "total": len(due_monitors),
                "up": 0,
                "down": 0,
                "degraded": 0,
                "errors": 0,
                "total_response_time_ms": 0.0,
            }

            # Ejecutar verificación para cada monitor
            for monitor in due_monitors:
                try:
                    result = MonitoringOrchestrator.run_check(monitor)

                    # Actualizar estado en DB (esto también registra historial)
                    ServiceMonitorService.update_status(
                        db,
                        monitor.id,
                        result.status,
                        status_code=result.status_code,
                        response_time_ms=result.response_time_ms,
                        error_message=result.error_message,
                    )

                    # Estadísticas
                    if result.status == MonitorStatus.UP:
                        stats["up"] += 1
                    elif result.status == MonitorStatus.DOWN:
                        stats["down"] += 1
                    elif result.status == MonitorStatus.DEGRADED:
                        stats["degraded"] += 1
                    else:
                        stats["errors"] += 1

                    if result.response_time_ms:
                        stats["total_response_time_ms"] += result.response_time_ms

                except Exception as e:
                    logger.error(
                        "[MONITORING] Error verificando monitor '%s' (ID=%s): %s",
                        monitor.label, monitor.id, e, exc_info=True,
                    )
                    stats["errors"] += 1

            avg_response = (
                stats["total_response_time_ms"] / stats["total"]
                if stats["total"] > 0
                else 0
            )

            logger.info(
                "[MONITORING] === Ronda completada: %d verificados, "
                "%d UP, %d DOWN, %d DEGRADED, %d errores "
                "(tiempo promedio: %.1fms) ===",
                stats["total"], stats["up"], stats["down"],
                stats["degraded"], stats["errors"], avg_response,
            )

            return {
                "status": "ok",
                "checked": stats["total"],
                "monitors_due": len(due_monitors),
                "up": stats["up"],
                "down": stats["down"],
                "degraded": stats["degraded"],
                "errors": stats["errors"],
                "avg_response_time_ms": round(avg_response, 2),
            }

        finally:
            db.close()

    except Exception as exc:
        logger.error(
            "[MONITORING] Error crítico en ronda de verificación: %s",
            exc, exc_info=True,
        )
        # Reintentar con backoff exponencial
        raise self.retry(exc=exc)


@celery_app.task(
    name="monitoring.check_single",
    bind=True,
    max_retries=2,
    default_retry_delay=5,
)
def monitor_check_single(self, monitor_id: int) -> dict:
    """Verifica un monitor específico por ID.

    Útil para verificaciones manuales desde la API o programadas
    individualmente.

    Args:
        monitor_id: ID del monitor a verificar.

    Returns:
        dict con el resultado de la verificación.
    """
    logger.info("[MONITORING] Verificación manual solicitada para monitor ID=%s", monitor_id)

    try:
        from src.database import SessionLocal
        from src.services.monitoring_engine import MonitoringOrchestrator
        from src.services.settings_service import ServiceMonitorService

        db = SessionLocal()
        try:
            monitor = ServiceMonitorService.get_by_id(db, monitor_id)

            if monitor is None:
                logger.warning("[MONITORING] Monitor ID=%s no encontrado", monitor_id)
                return {
                    "status": "error",
                    "error": f"Monitor ID={monitor_id} no encontrado",
                }

            result = MonitoringOrchestrator.run_check(monitor)

            ServiceMonitorService.update_status(
                db,
                monitor.id,
                result.status,
                status_code=result.status_code,
                response_time_ms=result.response_time_ms,
                error_message=result.error_message,
            )

            logger.info(
                "[MONITORING] Verificación manual %s (ID=%s): %s (%.1fms)",
                monitor.label, monitor_id, result.status.value,
                result.response_time_ms or 0,
            )

            return {
                "status": "ok",
                "monitor_id": monitor_id,
                "label": monitor.label,
                "result_status": result.status.value,
                "status_code": result.status_code,
                "response_time_ms": result.response_time_ms,
                "error_message": result.error_message,
            }

        finally:
            db.close()

    except Exception as exc:
        logger.error(
            "[MONITORING] Error en verificación manual monitor ID=%s: %s",
            monitor_id, exc, exc_info=True,
        )
        raise self.retry(exc=exc)
