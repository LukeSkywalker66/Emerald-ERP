"""
Router REST para Gestión de Tareas de Ingeniería/NOC

Endpoints para CRUD de tareas, transiciones de estado, y analytics.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from src.database import get_db
from src.services.engineering_service import EngineeringService
from src.schemas.engineering import (
    EngineeringTaskCreate,
    EngineeringTaskUpdate,
    EngineeringTaskRead,
    EngineeringTaskListResponse,
    EngineeringTaskDetailResponse,
    EngineeringTaskStatsResponse,
    EngineeringTaskTimelineEventResponse,
    EngineeringTaskTimelineNoteCreate,
)


router = APIRouter(
    prefix="/api/v2/engineering",
    tags=["Engineering/NOC"],
    responses={
        404: {"description": "Recurso no encontrado"},
        400: {"description": "Solicitud inválida"},
        422: {"description": "Error de validación"},
    }
)


# ===========================
# AUTH DEPENDENCY
# ===========================

def get_user_id(request: Request) -> int:
    """Extrae el user_id del request.state (configurado por middleware)."""
    return getattr(request.state, "user_id", 2)  # User admin@emerald.com por defecto


# ===========================
# CRUD ENDPOINTS
# ===========================

@router.post(
    "/tasks",
    response_model=EngineeringTaskRead,
    status_code=201,
    summary="Crear nueva tarea de ingeniería",
    description="""
    Crea una nueva tarea de ingeniería.

    **Flujos soportados:**
    - **REACTIVO** (ticket_id ≠ NULL): Tarea derivada de un ticket de soporte
      - Valida que el ticket exista
      - Actualiza ticket.status → "waiting_internal"
      - Crea evento en TicketTimeline

    - **PROACTIVO** (ticket_id = NULL): Tarea de mantenimiento/diagnóstico interno
      - Tarea standalone, sin relación con ticket

    **Parámetros:**
    - `title`: Título de la tarea (5-255 caracteres, requerido)
    - `description`: Descripción detallada (opcional)
    - `task_type`: "incident", "maintenance", o "project"
    - `priority`: "critical", "high", "medium", "low"
    - `ticket_id`: ID de ticket (NULL para proactivas)
    - `assigned_to_id`: ID del ingeniero asignado (opcional, puede asignarse después)
    - `scheduled_date`: Fecha estimada de inicio (ISO 8601, opcional)
    """
)
def create_task(
    payload: EngineeringTaskCreate,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Crear una nueva tarea de ingeniería."""
    try:
        service = EngineeringService(db)
        return service.create_task(payload, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get(
    "/tasks",
    response_model=List[EngineeringTaskListResponse],
    summary="Listar tareas de ingeniería",
    description="""
    Lista tareas con filtros opcionales.

    **Filtros disponibles:**
    - `status`: "backlog", "in_progress", "testing", "completed", "rejected"
    - `assigned_to_id`: Filtrar por ingeniero asignado
    - `task_type`: "incident", "maintenance", "project"
    - `priority`: "critical", "high", "medium", "low"
    - `ticket_id`: Tareas de un ticket específico

    **Ordenamiento:**
    - Prioridad descendente (critical → low)
    - Fecha de creación descendente (más recientes primero)

    **Paginación:**
    - `limit`: Máximo 100 resultados (default 50)
    - `offset`: Desplazamiento (default 0)
    """
)
def list_tasks(
    status: Optional[str] = Query(None, description="Filtrar por estado"),
    assigned_to_id: Optional[int] = Query(None, description="Filtrar por ingeniero asignado"),
    task_type: Optional[str] = Query(None, description="Filtrar por tipo"),
    priority: Optional[str] = Query(None, description="Filtrar por prioridad"),
    ticket_id: Optional[int] = Query(None, description="Filtrar por ticket"),
    limit: int = Query(50, ge=1, le=100, description="Límite de resultados"),
    offset: int = Query(0, ge=0, description="Offset para paginación"),
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Listar tareas con filtros."""
    try:
        service = EngineeringService(db)
        return service.list_tasks(
            status=status,
            assigned_to_id=assigned_to_id,
            task_type=task_type,
            priority=priority,
            ticket_id=ticket_id,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get(
    "/tasks/{task_id}",
    response_model=EngineeringTaskDetailResponse,
    summary="Obtener detalles de una tarea",
    description="""
    Obtiene los detalles completos de una tarea incluyendo:
    - Todos los campos de la tarea
    - Información del ticket padre (si es reactivo)
    - Datos del ingeniero asignado
    - Datos del usuario creador
    - Histórico de cambios de estado (timeline_data)
    """
)
def get_task(
    task_id: int,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Obtener detalles de una tarea."""
    try:
        service = EngineeringService(db)
        return service.get_task(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get(
    "/tasks/{task_id}/timeline",
    response_model=List[EngineeringTaskTimelineEventResponse],
    summary="Listar eventos del timeline de una tarea",
    description="""
    Lista los eventos de la bitácora de una tarea de ingeniería.
    """
)
def get_task_timeline(
    task_id: int,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Listar timeline de una tarea."""
    try:
        service = EngineeringService(db)
        return service.list_task_timeline(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post(
    "/tasks/{task_id}/timeline",
    response_model=EngineeringTaskTimelineEventResponse,
    status_code=201,
    summary="Agregar nota manual al timeline",
    description="""
    Agrega una nota manual a la bitácora de la tarea.
    """
)
def add_task_timeline_note(
    task_id: int,
    payload: EngineeringTaskTimelineNoteCreate,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Agregar nota al timeline de una tarea."""
    try:
        service = EngineeringService(db)
        return service.add_task_note(task_id, user_id, payload.content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.patch(
    "/tasks/{task_id}",
    response_model=EngineeringTaskRead,
    summary="Actualizar una tarea",
    description="""
    Actualiza los datos de una tarea.

    **Transiciones de estado válidas:**
    - `backlog` → `in_progress` (iniciar trabajo)
    - `in_progress` → `testing` (validación)
    - `testing` → `completed` (éxito, Ticket → "attention_required")
    - `testing` → `rejected` (validación fallida)
    - Cualquier estado → `rejected` (cancelación)

    **Side-effects de transiciones:**
    - `completed`: Ticket padre pasa a "attention_required"
    - `rejected`: Si hay ticket, vuelve a "pending"

    **Campos actualizables:**
    - `title`, `description`, `task_type`, `priority`
    - `assigned_to_id`, `scheduled_date`
    - `status` (transición de estado)
    - `resolution_note`, `rejection_reason`
    """
)
def update_task(
    task_id: int,
    payload: EngineeringTaskUpdate,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Actualizar una tarea."""
    try:
        service = EngineeringService(db)
        return service.update_task(task_id, payload, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post(
    "/tasks/{task_id}/complete",
    response_model=EngineeringTaskRead,
    summary="Marcar tarea como completada",
    description="""
    Completa una tarea con una nota de resolución.

    **Operación:**
    1. Realiza transición: `testing` → `completed`
    2. Registra nota de resolución
    3. Si hay ticket padre, lo actualiza a "attention_required"
    4. Registra evento en TicketTimeline

    **Body:**
    ```json
    {
        "resolution_note": "Fibra reparada. Cliente online. Speedtest OK."
    }
    ```
    """
)
def complete_task(
    task_id: int,
    resolution_note: str = Query(..., description="Nota de resolución"),
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Completar una tarea."""
    try:
        service = EngineeringService(db)
        return service.complete_task(task_id, resolution_note, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post(
    "/tasks/{task_id}/reject",
    response_model=EngineeringTaskRead,
    summary="Rechazar una tarea",
    description="""
    Rechaza una tarea con razón del rechazo.

    **Operación:**
    1. Realiza transición: * → `rejected`
    2. Registra razón de rechazo
    3. Si hay ticket padre, lo actualiza a "pending"
    4. Registra evento en TicketTimeline

    **Razones comunes:**
    - "Hardware defectuoso, requiere reemplazo"
    - "No se pudo acceder a la ubicación"
    - "Problema de tercero, fuera de scope"

    **Body:**
    ```json
    {
        "rejection_reason": "Hardware defectuoso. Requiere RMA del proveedor."
    }
    ```
    """
)
def reject_task(
    task_id: int,
    rejection_reason: str = Query(..., description="Razón del rechazo"),
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Rechazar una tarea."""
    try:
        service = EngineeringService(db)
        return service.reject_task(task_id, rejection_reason, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.delete(
    "/tasks/{task_id}",
    status_code=204,
    summary="Eliminar una tarea",
    description="""
    Elimina una tarea (solo si status = "backlog").

    **Restricción:** No se pueden eliminar tareas en progreso o completadas.

    **Error 400:** Si la tarea no está en estado "backlog"
    """
)
def delete_task(
    task_id: int,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Eliminar una tarea."""
    try:
        service = EngineeringService(db)
        service.delete_task(task_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# ===========================
# ANALYTICS ENDPOINTS
# ===========================

@router.get(
    "/stats/dashboard",
    response_model=EngineeringTaskStatsResponse,
    summary="Dashboard de estadísticas",
    description="""
    Genera estadísticas consolidadas para el dashboard de ingeniería.

    **Datos retornados:**
    - `total_tasks`: Total de tareas (todas las épocas)
    - `by_status`: Conteo por cada estado
    - `by_priority`: Conteo por cada nivel de prioridad
    - `by_type`: Conteo por tipo (incident, maintenance, project)
    - `assigned_to_me`: Tareas asignadas al usuario actual (sin completar)
    - `critical_count`: Tareas críticas sin completar

    **Uso en UI:**
    - KPIs en el header del dashboard
    - Gráficas de distribución
    - Alertas de tareas críticas
    """
)
def get_stats(
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """Obtener estadísticas del dashboard."""
    try:
        service = EngineeringService(db)
        return service.get_stats(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
