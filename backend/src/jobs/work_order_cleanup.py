"""
Job de Celery para gestión automática de Work Orders vencidas (Equipos Bloqueados).

NASA-grade Responsibility: OTs con status='scheduled' que pasaron su fecha/hora
programada y nunca se iniciaron, entran en modo 'pending_closure'.

EQUIPOS BLOQUEADOS:
- El técnico/equipo asignado NO puede recibir nuevas OTs hasta que cierre la vencida.
- La OT permanece asignada al equipo (tracking de responsabilidad).
- Se requiere cierre forzado con fotos, materiales y motivo.

Este job corre periódicamente y garantiza que no existan OTs "fantasma" sin
accountability.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from src.celery_app import celery_app
from src.database import SessionLocal
from src.models.tickets import WorkOrder, WorkOrderStatus, TicketTimeline, TicketTimelineEventType
from src.config import logger


@celery_app.task(name="cleanup_abandoned_work_orders")
def cleanup_abandoned_work_orders():
    """
    Detecta OTs vencidas no ejecutadas y las marca como 'pending_closure'.
    
    EQUIPOS BLOQUEADOS - Criterios de bloqueo:
    - status = 'scheduled' (coordinada pero no iniciada)
    - scheduled_start < now - grace_period (pasó la fecha programada)
    - team_id o technician_id != None (responsable asignado)
    
    Acción:
    - Cambia status a 'pending_closure' (bloquea agenda del técnico)
    - MANTIENE team_id/technician_id (tracking de responsabilidad)
    - MANTIENE scheduled_start (historial inmutable)
    - Registra evento en timeline
    
    El técnico no puede recibir nuevas OTs hasta que cierre esta con:
    - Fotos obligatorias
    - Materiales utilizados
    - Motivo de cierre (éxito/fallo)
    
    Returns:
        dict: Estadísticas de la operación
    """
    db = SessionLocal()
    
    try:
        # Grace period: 30 minutos después de la hora programada
        grace_period = timedelta(minutes=30)
        now = datetime.now(timezone.utc)
        cutoff_time = now - grace_period
        
        logger.info(f"[BLOQUEO] Iniciando detección de OTs vencidas (Equipos Bloqueados)...")
        logger.info(f"[BLOQUEO] Cutoff time: {cutoff_time.isoformat()}")
        
        # Buscar OTs vencidas no ejecutadas
        abandoned_orders = db.query(WorkOrder).filter(
            WorkOrder.status == WorkOrderStatus.scheduled,
            WorkOrder.team_id.isnot(None),
            WorkOrder.scheduled_start.isnot(None),
            WorkOrder.scheduled_start < cutoff_time
        ).all()
        
        if not abandoned_orders:
            logger.info("[BLOQUEO] ✅ No hay OTs vencidas sin ejecutar")
            return {
                "status": "success",
                "overdue_count": 0,
                "locked_count": 0
            }
        
        logger.warning(f"[BLOQUEO] ⚠️ Encontradas {len(abandoned_orders)} OTs vencidas → Bloqueando agendas")
        
        locked_count = 0
        for wo in abandoned_orders:
            team_id = wo.team_id
            scheduled = wo.scheduled_start
            
            # ========== EQUIPOS BLOQUEADOS ==========
            # NO limpiar asignación - el técnico/equipo queda responsable
            # NO limpiar scheduled_start - historial inmutable para auditoría
            wo.status = WorkOrderStatus.pending_closure
            
            # Registrar en timeline
            db.add(TicketTimeline(
                ticket_id=wo.ticket_id,
                author_id=None,  # Sistema automático
                event_type=TicketTimelineEventType.ot_event,
                content=f"🔒 Sistema: OT vencida sin ejecutar → Status 'pending_closure' (fecha programada: {scheduled.strftime('%d/%m %H:%M')}). El técnico debe cerrar con fotos/materiales antes de recibir nuevas asignaciones.",
                meta_data={
                    "work_order_id": wo.id,
                    "reason": "technician_prison_overdue",
                    "locked_team_id": team_id,
                    "original_scheduled_start": scheduled.isoformat(),
                    "pattern": "Equipos Bloqueados"
                }
            ))
            
            locked_count += 1
            logger.info(f"[BLOQUEO]   ↳ OT #{wo.id} (Ticket #{wo.ticket_id}) → pending_closure (Equipo #{team_id} bloqueado)")
        
        db.commit()
        
        logger.info(f"[BLOQUEO] ✅ {locked_count} OTs marcadas como 'pending_closure' → Agendas bloqueadas")
        
        # ── Registrar ejecución exitosa ────────────────────────────────
        _record_cleanup_execution("success", f"{locked_count} OTs bloqueadas de {len(abandoned_orders)} vencidas")
        
        return {
            "status": "success",
            "overdue_count": len(abandoned_orders),
            "locked_count": locked_count,
            "cutoff_time": cutoff_time.isoformat(),
            "pattern": "Equipos Bloqueados"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"[BLOQUEO] ❌ Error en detección de OTs vencidas: {str(e)}", exc_info=True)
        
        # ── Registrar ejecución fallida ─────────────────────────────────
        _record_cleanup_execution("failed", str(e))
        
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        db.close()


def _record_cleanup_execution(status: str, detail: str) -> None:
    """Registra la ejecución del cleanup en la tabla scheduled_tasks."""
    try:
        from src.services.scheduled_task_service import ScheduledTaskService
        from src.database import SessionLocal as ScheduledSessionLocal
        
        _db = ScheduledSessionLocal()
        try:
            ScheduledTaskService.record_execution(
                _db,
                task_name="cleanup_abandoned_work_orders",
                status=status,
                detail=detail,
            )
        finally:
            _db.close()
    except Exception as record_err:
        import logging
        logging.getLogger(__name__).warning(
            f"No se pudo registrar ejecución en scheduled_tasks: {record_err}"
        )
