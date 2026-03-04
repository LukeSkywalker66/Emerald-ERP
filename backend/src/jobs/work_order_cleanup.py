"""
Job de Celery para auto-cleanup de Work Orders abandonadas.

NASA-grade Consistency: OTs con status='scheduled' que pasaron su fecha/hora
y nunca se iniciaron, deben volver automáticamente al backlog para reprogramación.

Este job corre periódicamente y garantiza que no existan OTs "fantasma" en estado
coordinado que nunca se ejecutaron.
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
    Detecta y limpia OTs abandonadas.
    
    Criterios de abandono:
    - status = 'scheduled' (coordinada pero no iniciada)
    - scheduled_start < now - grace_period (pasó la fecha programada)
    - team_id != None (tiene equipo asignado pero no se presentó)
    
    Acción:
    - Devuelve al backlog (team_id = None, scheduled_start = None)
    - Cambia status a 'pending_planning' 
    - Registra evento en timeline
    
    Returns:
        dict: Estadísticas de la operación
    """
    db = SessionLocal()
    
    try:
        # Grace period: 30 minutos después de la hora programada
        grace_period = timedelta(minutes=30)
        now = datetime.now(timezone.utc)
        cutoff_time = now - grace_period
        
        logger.info(f"[CLEANUP] Iniciando auto-cleanup de OTs abandonadas...")
        logger.info(f"[CLEANUP] Cutoff time: {cutoff_time.isoformat()}")
        
        # Buscar OTs abandonadas
        abandoned_orders = db.query(WorkOrder).filter(
            WorkOrder.status == WorkOrderStatus.scheduled,
            WorkOrder.team_id.isnot(None),
            WorkOrder.scheduled_start.isnot(None),
            WorkOrder.scheduled_start < cutoff_time
        ).all()
        
        if not abandoned_orders:
            logger.info("[CLEANUP] ✅ No hay OTs abandonadas para limpiar")
            return {
                "status": "success",
                "abandoned_count": 0,
                "cleaned_count": 0
            }
        
        logger.warning(f"[CLEANUP] ⚠️ Encontradas {len(abandoned_orders)} OTs abandonadas")
        
        cleaned_count = 0
        for wo in abandoned_orders:
            old_team_id = wo.team_id
            old_scheduled = wo.scheduled_start
            
            # Limpiar asignación
            wo.team_id = None
            wo.scheduled_start = None
            wo.status = WorkOrderStatus.pending_planning
            
            # Registrar en timeline
            db.add(TicketTimeline(
                ticket_id=wo.ticket_id,
                author_id=None,  # Sistema automático
                event_type=TicketTimelineEventType.ot_event,
                content=f"🤖 Sistema: OT devuelta automáticamente al backlog (no se ejecutó en fecha programada: {old_scheduled.strftime('%d/%m %H:%M')})",
                meta_data={
                    "work_order_id": wo.id,
                    "reason": "auto_cleanup_abandoned",
                    "old_team_id": old_team_id,
                    "old_scheduled_start": old_scheduled.isoformat()
                }
            ))
            
            cleaned_count += 1
            logger.info(f"[CLEANUP]   ↳ OT #{wo.id} (Ticket #{wo.ticket_id}) devuelta al backlog")
        
        db.commit()
        
        logger.info(f"[CLEANUP] ✅ {cleaned_count} OTs limpiadas y devueltas al backlog")
        
        return {
            "status": "success",
            "abandoned_count": len(abandoned_orders),
            "cleaned_count": cleaned_count,
            "cutoff_time": cutoff_time.isoformat()
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"[CLEANUP] ❌ Error en auto-cleanup: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        db.close()
