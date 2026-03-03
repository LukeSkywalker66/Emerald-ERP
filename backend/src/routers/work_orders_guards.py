"""Guards y validaciones para lógica de negocio de Work Orders."""

from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.models.tickets import WorkOrder, WorkOrderStatus, TicketTimeline, TicketTimelineEventType
from src.models.user import User


def validate_coordination_not_locked(
    wo: WorkOrder,
    db: Session,
    current_user: User,
    operation: str = "update",  # "update", "assign", "unassign"
    override_reason: str = None
):
    """
    Valida si una OT puede ser modificada según su estado y fecha.
    
    **Reglas:**
    1. Si status = "completed" → SIEMPRE bloqueado (inmutable)
    2. Si status = "failed" → SIEMPRE bloqueado (inmutable)
    3. Si scheduled_start es pasada (< now - 5min grace) Y operación = "assign" → Bloqueado
    4. Si hay override_reason de superuser → Log audit y permitir
    
    **Estados editables:**
    - pending_planning: Totalmente editable
    - coordinated: Editable (puede cambiar fecha/equipo)
    - scheduled: Editable si no está muy cerca de ejecutarse (< ahora)
    - assigned: Editable
    - in_progress: Solo cambios de estado/resolución
    
    **Retorna:** None si OK, levanta HTTPException si bloqueado
    """
    
    # ===== VALIDACIÓN 1: OTs COMPLETADAS/FALLIDAS SON INMUTABLES =====
    if wo.status in [WorkOrderStatus.completed, WorkOrderStatus.failed]:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Orden de trabajo no puede ser modificada. Estado: {wo.status.value} (inmutable)",
            headers={
                "X-Locked-Reason": "LOCKED_COMPLETED_OR_FAILED",
                "X-Work-Order-Status": wo.status.value,
            }
        )
    
    # ===== VALIDACIÓN 2: NO PERMITIR ASIGNAR A FECHAS PASADAS =====
    if operation in ["assign", "reassign"]:
        # 5 minutos de gracia para jitter/timezones
        grace_period = timedelta(minutes=5)
        now = datetime.now(timezone.utc)
        
        # Obtener fecha propuesta (o actual si no hay cambio)
        proposed_scheduled_start = getattr(wo, '_proposed_scheduled_start', wo.scheduled_start)
        
        if proposed_scheduled_start:
            # Normalizar a UTC si tiene timezone
            if proposed_scheduled_start.tzinfo is None:
                proposed_scheduled_start = proposed_scheduled_start.replace(tzinfo=timezone.utc)
            
            if proposed_scheduled_start < (now - grace_period):
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"No se puede asignar a una fecha pasada ({proposed_scheduled_start.isoformat()})",
                    headers={
                        "X-Locked-Reason": "LOCKED_PAST_DATE",
                        "X-Proposed-Date": proposed_scheduled_start.isoformat(),
                        "X-Current-Time": now.isoformat(),
                    }
                )
    
    # ===== VALIDACIÓN 3: OVERRIDE CON AUDIT TRAIL =====
    if override_reason and current_user.role and current_user.role.name == "admin":
        # Admin puede hacer override, pero registra en timeline
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=current_user.id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"✓ OVERRIDE ADMIN: {operation.upper()} en OT #{wo.id}",
            meta_data={
                "override_reason": override_reason,
                "work_order_status": wo.status.value,
                "operation": operation,
                "ip_address": getattr(current_user, '_request_ip', 'unknown'),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        db.add(timeline_event)
        return  # Permitir la operación
    
    # Si llegamos acá y hay override_reason pero NO es admin → rechazar
    if override_reason and (not current_user.role or current_user.role.name != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden usar override_reason"
        )


def get_coordination_options_for_incomplete_work_order(wo: WorkOrder) -> dict:
    """
    Cuando un trabajo NO fue completado (ej: técnico marca como incompleto),
    retorna las opciones disponibles para el coordinador.
    
    **Retorna:**
    ```python
    {
        "reschedule": {
            "description": "Reprogramar para otra fecha",
            "available": True,
            "new_wo_required": False,
        },
        "reopen_backlog": {
            "description": "Devolver al backlog para reprogramación",
            "available": True,
            "new_wo_required": False,
        },
        "create_new_from_ticket": {
            "description": "Cerrar esta OT y crear nueva desde ticket",
            "available": True,
            "new_wo_required": True,
            "reason": "Cuando el trabajo requiere replanteo completo"
        }
    }
    ```
    """
    return {
        "reschedule": {
            "description": "Reprogramar para otra fecha/hora",
            "available": wo.status in [WorkOrderStatus.in_progress, WorkOrderStatus.scheduled],
            "action": "PATCH /{work_order_id}",
            "params": {"scheduled_start": "2026-03-15T14:00:00Z", "estimated_duration": 90},
        },
        "reopen_backlog": {
            "description": "Devolver al backlog para reprogramación manual",
            "available": wo.team_id is not None,
            "action": "DELETE /{work_order_id}/assign",
            "effect": "Quita equipo, vuelve a coordinated/pending_planning",
        },
        "create_new_from_ticket": {
            "description": "Cerrar esta OT y crear nueva desde ticket original",
            "available": True,
            "action": "POST /v2/work-orders",
            "effect": "Nueva OT con misma conexión/ticket, this WO marked as failed",
            "reason": "Para replanteo completo o cambio de scope"
        },
    }
