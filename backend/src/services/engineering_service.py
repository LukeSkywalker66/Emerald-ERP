"""
Servicio de Gestión de Tareas de Ingeniería/NOC

Lógica de negocio para CRUD de tareas, transiciones de estado,
sincronización con tickets, y generación de eventos de timeline.
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, and_

from src.models.engineering import (
    EngineeringTask,
    EngineeringTaskStatus,
    EngineeringTaskType,
    EngineeringTaskPriority,
    EngineeringTaskTimeline,
    EngineeringTaskTimelineEventType,
)
from src.models.tickets import Ticket, TicketStatus, TicketTimeline, TicketTimelineEventType
from src.models.user import User
from src.schemas.engineering import (
    EngineeringTaskCreate,
    EngineeringTaskUpdate,
    EngineeringTaskRead,
    EngineeringTaskListResponse,
    EngineeringTaskDetailResponse,
    EngineeringTaskStatsResponse,
    EngineeringTaskTimelineEventResponse,
)


class EngineeringService:
    """Servicio para gestión de tareas de ingeniería."""

    def __init__(self, db: Session):
        self.db = db

    # ===========================
    # CRUD BÁSICO
    # ===========================

    def create_task(
        self,
        payload: EngineeringTaskCreate,
        creator_id: int
    ) -> EngineeringTaskRead:
        """
        Crea una nueva tarea de ingeniería.

        Si ticket_id es proporcionado (flujo REACTIVO):
          1. Valida que el ticket exista
          2. Actualiza ticket.status → "waiting_internal"
          3. Crea evento en TicketTimeline

        Si ticket_id es NULL (flujo PROACTIVO):
          1. Crea tarea standalone

        Args:
            payload: Datos de la tarea
            creator_id: ID del usuario creador

        Returns:
            EngineeringTaskRead con la tarea creada

        Raises:
            HTTPException 404: Si ticket_id no existe
        """
        # Validar ticket si es proporcionado
        if payload.ticket_id:
            ticket = self.db.query(Ticket).filter(
                Ticket.id == payload.ticket_id
            ).first()
            if not ticket:
                raise ValueError(f"Ticket {payload.ticket_id} no encontrado")

        # Crear tarea
        task = EngineeringTask(
            ticket_id=payload.ticket_id,
            title=payload.title,
            description=payload.description,
            task_type=payload.task_type,
            priority=payload.priority,
            scheduled_date=payload.scheduled_date,
            assigned_to_id=payload.assigned_to_id,
            created_by_id=creator_id,
            timeline_data={
                "events": [
                    {
                        "timestamp": datetime.utcnow().isoformat(),
                        "action": "created",
                        "by_user_id": creator_id,
                        "details": f"Tarea creada. Tipo: {payload.task_type}, Prioridad: {payload.priority}"
                    }
                ]
            }
        )

        self.db.add(task)
        self.db.flush()

        # Si es reactivo, actualizar ticket y agregar evento en timeline
        if payload.ticket_id and task.ticket:
            self._update_ticket_status(
                ticket=task.ticket,
                new_status=TicketStatus.waiting_internal,
                message=f"✓ Tarea de ingeniería creada: {task.title}"
            )

            # Crear evento en TicketTimeline con link y estado
            timeline_event = TicketTimeline(
                ticket_id=task.ticket.id,
                author_id=creator_id,
                event_type=TicketTimelineEventType.alert,
                content=f"Tarea de ingeniería creada: <a href='/app/engineering?task={task.id}' class='text-emerald-400 hover:underline'>#{task.id} - {task.title}</a>",
                meta_data={
                    "engineering_task_id": task.id,
                    "engineering_task_status": task.status,
                    "priority": task.priority,
                    "task_type": task.task_type,
                }
            )
            self.db.add(timeline_event)

        self.db.commit()
        self.db.refresh(task)

        return EngineeringTaskRead.model_validate(task)

    def get_task(self, task_id: int) -> EngineeringTaskDetailResponse:
        """
        Obtiene los detalles completos de una tarea.

        Args:
            task_id: ID de la tarea

        Returns:
            EngineeringTaskDetailResponse con todos los datos

        Raises:
            ValueError: Si la tarea no existe
        """
        task = self.db.query(EngineeringTask).filter(
            EngineeringTask.id == task_id
        ).first()

        if not task:
            raise ValueError(f"Tarea {task_id} no encontrada")

        return EngineeringTaskDetailResponse.model_validate(task)

    def list_tasks(
        self,
        status: Optional[str] = None,
        assigned_to_id: Optional[int] = None,
        task_type: Optional[str] = None,
        priority: Optional[str] = None,
        ticket_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[EngineeringTaskListResponse]:
        """
        Lista tareas con filtros opcionales.

        Args:
            status: Filtrar por estado (backlog, in_progress, testing, completed, rejected)
            assigned_to_id: Filtrar por ingeniero asignado
            task_type: Filtrar por tipo (incident, maintenance, project)
            priority: Filtrar por prioridad (critical, high, medium, low)
            ticket_id: Filtrar por ticket (NULL para proactivas)
            limit: Límite de resultados (default 50)
            offset: Offset para paginación (default 0)

        Returns:
            Lista de EngineeringTaskListResponse
        """
        query = self.db.query(EngineeringTask)

        # Aplicar filtros
        if status:
            query = query.filter(EngineeringTask.status == status)
        if assigned_to_id is not None:
            query = query.filter(EngineeringTask.assigned_to_id == assigned_to_id)
        if task_type:
            query = query.filter(EngineeringTask.task_type == task_type)
        if priority:
            query = query.filter(EngineeringTask.priority == priority)
        if ticket_id is not None:
            query = query.filter(EngineeringTask.ticket_id == ticket_id)

        # Orden y paginación
        tasks = query.order_by(
            desc(EngineeringTask.priority),
            desc(EngineeringTask.created_at)
        ).limit(limit).offset(offset).all()

        return [
            EngineeringTaskListResponse.model_validate(task)
            for task in tasks
        ]

    def update_task(
        self,
        task_id: int,
        payload: EngineeringTaskUpdate,
        user_id: int
    ) -> EngineeringTaskRead:
        """
        Actualiza una tarea (campos simples o transiciones de estado).

        Si payload.status es distinto al actual:
          1. Valida transición válida
          2. Ejecuta lógica de side-effects (ej: actualizar Ticket)
          3. Registra cambio en timeline_data

        Args:
            task_id: ID de la tarea
            payload: Datos a actualizar
            user_id: ID del usuario que realiza la actualización

        Returns:
            EngineeringTaskRead actualizado

        Raises:
            ValueError: Si la transición de estado es inválida
        """
        task = self.db.query(EngineeringTask).filter(
            EngineeringTask.id == task_id
        ).first()

        if not task:
            raise ValueError(f"Tarea {task_id} no encontrada")

        # Manejar transición de estado si es incluida
        if payload.status and payload.status != task.status:
            self._transition_status(task, payload.status, user_id)

        # Actualizar campos simples
        if payload.title is not None:
            task.title = payload.title
        if payload.description is not None:
            task.description = payload.description
        if payload.task_type is not None:
            task.task_type = payload.task_type
        if payload.priority is not None:
            task.priority = payload.priority
        if payload.scheduled_date is not None:
            task.scheduled_date = payload.scheduled_date
        if "assigned_to_id" in payload.model_fields_set:
            old_assigned_id = task.assigned_to_id
            new_assigned_id = payload.assigned_to_id
            if new_assigned_id != old_assigned_id:
                task.assigned_to_id = new_assigned_id
                assignment_text = self._format_assignment_change(
                    old_assigned_id=old_assigned_id,
                    new_assigned_id=new_assigned_id
                )
                self._create_task_timeline_event(
                    task_id=task.id,
                    author_id=user_id,
                    event_type=EngineeringTaskTimelineEventType.ASSIGNMENT,
                    content=assignment_text
                )
        if payload.resolution_note is not None:
            task.resolution_note = payload.resolution_note
        if payload.rejection_reason is not None:
            task.rejection_reason = payload.rejection_reason

        self.db.commit()
        self.db.refresh(task)

        return EngineeringTaskRead.model_validate(task)

    def list_task_timeline(self, task_id: int) -> List[EngineeringTaskTimelineEventResponse]:
        """
        Lista eventos de timeline de una tarea.
        """
        task = self.db.query(EngineeringTask).filter(
            EngineeringTask.id == task_id
        ).first()

        if not task:
            raise ValueError(f"Tarea {task_id} no encontrada")

        events = (
            self.db.query(EngineeringTaskTimeline)
            .filter(EngineeringTaskTimeline.task_id == task_id)
            .order_by(EngineeringTaskTimeline.created_at.desc())
            .all()
        )

        return [EngineeringTaskTimelineEventResponse.model_validate(ev) for ev in events]

    def add_task_note(
        self,
        task_id: int,
        author_id: int,
        content: str
    ) -> EngineeringTaskTimelineEventResponse:
        """
        Agrega una nota manual al timeline de una tarea.
        """
        task = self.db.query(EngineeringTask).filter(
            EngineeringTask.id == task_id
        ).first()

        if not task:
            raise ValueError(f"Tarea {task_id} no encontrada")

        event = EngineeringTaskTimeline(
            task_id=task_id,
            author_id=author_id,
            event_type=EngineeringTaskTimelineEventType.NOTE,
            content=content
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        return EngineeringTaskTimelineEventResponse.model_validate(event)

    def delete_task(self, task_id: int) -> None:
        """
        Elimina una tarea (solo si status=backlog).

        Args:
            task_id: ID de la tarea

        Raises:
            ValueError: Si la tarea no existe o no está en backlog
        """
        task = self.db.query(EngineeringTask).filter(
            EngineeringTask.id == task_id
        ).first()

        if not task:
            raise ValueError(f"Tarea {task_id} no encontrada")

        if task.status != EngineeringTaskStatus.backlog:
            raise ValueError(
                f"Solo se pueden eliminar tareas en estado 'backlog'. "
                f"Actual: {task.status}"
            )

        self.db.delete(task)
        self.db.commit()

    # ===========================
    # MÁQUINA DE ESTADOS
    # ===========================

    def _transition_status(
        self,
        task: EngineeringTask,
        new_status: str,
        user_id: int
    ) -> None:
        """
        Realiza transición de estado con side-effects (actualizar Ticket, Timeline).

        Transiciones válidas:
          - backlog → in_progress: Solo requiere asignación
          - in_progress → testing: Validación iniciada
          - testing → completed: Éxito (Ticket: waiting_internal → attention_required)
          - testing → rejected: Validación fallida (puede volver a in_progress)
          - * → rejected: Cancelación (si ticket_id, Ticket: waiting_internal → pending)

        Args:
            task: Instancia de EngineeringTask
            new_status: Nuevo estado
            user_id: ID del usuario que realiza el cambio

        Raises:
            ValueError: Si la transición es inválida
        """
        old_status = task.status
        # Permitir cualquier transición entre estados (libre Kanban)
        # (Opcional: bloquear solo si se quiere evitar rejected <-> completed, etc)

        # Registrar timestamp de transición
        if new_status == EngineeringTaskStatus.in_progress and not task.started_at:
            task.started_at = datetime.utcnow()
        
        if new_status in [EngineeringTaskStatus.completed, EngineeringTaskStatus.rejected]:
            task.completed_at = datetime.utcnow()

        # Ejecutar side-effects según transición
        if new_status == EngineeringTaskStatus.completed:
            # Tarea completada → Ticket pasa a "attention_required"
            if task.ticket:
                self._update_ticket_status(
                    ticket=task.ticket,
                    new_status=TicketStatus.attention_required,
                    message=f"✓ Tarea completada: {task.title}"
                )

        elif new_status == EngineeringTaskStatus.rejected:
            # Tarea rechazada → Ticket vuelve a "pending"
            if task.ticket:
                self._update_ticket_status(
                    ticket=task.ticket,
                    new_status=TicketStatus.pending,
                    message=f"✗ Tarea rechazada: {task.title}"
                )

        # Actualizar estado y timeline
        task.status = new_status
        self._add_timeline_event(
            task=task,
            action=f"status_transition_{old_status}_to_{new_status}",
            user_id=user_id,
            details=f"Estado cambió de {old_status} a {new_status}"
        )

        status_label = self._format_status_label(new_status)
        self._create_task_timeline_event(
            task_id=task.id,
            author_id=user_id,
            event_type=EngineeringTaskTimelineEventType.STATUS_CHANGE,
            content=f"Estado cambiado a {status_label}"
        )

    def _update_ticket_status(
        self,
        ticket: Ticket,
        new_status: TicketStatus,
        message: str
    ) -> None:
        """
        Actualiza estado de ticket y crea evento en timeline.

        Args:
            ticket: Instancia de Ticket
            new_status: Nuevo estado
            message: Mensaje de evento
        """
        ticket.status = new_status

        # Crear evento en TicketTimeline
        timeline_event = TicketTimeline(
            ticket_id=ticket.id,
            event_type=TicketTimelineEventType.status_change,
            content=message,
            metadata={
                "source": "engineering",
                "auto_generated": True
            }
        )
        self.db.add(timeline_event)

    def _add_timeline_event(
        self,
        task: EngineeringTask,
        action: str,
        user_id: int,
        details: str
    ) -> None:
        """
        Agrega evento al timeline_data (JSONB) de la tarea.

        Args:
            task: Instancia de EngineeringTask
            action: Tipo de acción
            user_id: ID del usuario
            details: Descripción del evento
        """
        if not task.timeline_data:
            task.timeline_data = {"events": []}

        task.timeline_data["events"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "by_user_id": user_id,
            "details": details
        })

    def _create_task_timeline_event(
        self,
        task_id: int,
        author_id: int,
        event_type: EngineeringTaskTimelineEventType,
        content: str
    ) -> None:
        """
        Crea un evento en la tabla de timeline de tareas.
        """
        event = EngineeringTaskTimeline(
            task_id=task_id,
            author_id=author_id,
            event_type=event_type,
            content=content
        )
        self.db.add(event)

    def _format_status_label(self, status: str) -> str:
        labels = {
            "backlog": "Backlog",
            "in_progress": "En Progreso",
            "testing": "En Pruebas",
            "completed": "Completada",
            "rejected": "Rechazada",
        }
        return labels.get(str(status), str(status))

    def _format_assignment_change(
        self,
        old_assigned_id: Optional[int],
        new_assigned_id: Optional[int]
    ) -> str:
        if new_assigned_id is None:
            return "Asignación removida"

        user = self.db.query(User).filter(User.id == new_assigned_id).first()
        user_label = user.full_name or user.email if user else f"Usuario #{new_assigned_id}"

        if old_assigned_id is None:
            return f"Asignado a {user_label}"

        return f"Reasignado a {user_label}"

    def complete_task(
        self,
        task_id: int,
        resolution_note: str,
        user_id: int
    ) -> EngineeringTaskRead:
        """
        Completa una tarea (transición a completed + nota de resolución).

        Args:
            task_id: ID de la tarea
            resolution_note: Nota de resolución
            user_id: ID del usuario que completa

        Returns:
            EngineeringTaskRead actualizado
        """
        task = self.db.query(EngineeringTask).filter(
            EngineeringTask.id == task_id
        ).first()

        if not task:
            raise ValueError(f"Tarea {task_id} no encontrada")

        self._transition_status(task, EngineeringTaskStatus.completed, user_id)
        task.resolution_note = resolution_note

        self.db.commit()
        self.db.refresh(task)

        return EngineeringTaskRead.model_validate(task)

    def reject_task(
        self,
        task_id: int,
        rejection_reason: str,
        user_id: int
    ) -> EngineeringTaskRead:
        """
        Rechaza una tarea (transición a rejected + razón de rechazo).

        Args:
            task_id: ID de la tarea
            rejection_reason: Razón del rechazo
            user_id: ID del usuario que rechaza

        Returns:
            EngineeringTaskRead actualizado
        """
        task = self.db.query(EngineeringTask).filter(
            EngineeringTask.id == task_id
        ).first()

        if not task:
            raise ValueError(f"Tarea {task_id} no encontrada")

        self._transition_status(task, EngineeringTaskStatus.rejected, user_id)
        task.rejection_reason = rejection_reason

        self.db.commit()
        self.db.refresh(task)

        return EngineeringTaskRead.model_validate(task)

    # ===========================
    # ANALYTICS
    # ===========================

    def get_stats(self, user_id: Optional[int] = None) -> EngineeringTaskStatsResponse:
        """
        Genera estadísticas de tareas (para dashboard).

        Si user_id es proporcionado, filtra por tareas asignadas al usuario.

        Args:
            user_id: ID del usuario actual (opcional)

        Returns:
            EngineeringTaskStatsResponse con conteos
        """
        query = self.db.query(EngineeringTask)

        # Todos los datos
        all_tasks = query.all()
        total = len(all_tasks)

        # Conteos por estado
        by_status = {}
        for status in EngineeringTaskStatus:
            count = len([t for t in all_tasks if t.status == status])
            if count > 0:
                by_status[status.value] = count

        # Conteos por prioridad
        by_priority = {}
        for priority in EngineeringTaskPriority:
            count = len([t for t in all_tasks if t.priority == priority])
            if count > 0:
                by_priority[priority.value] = count

        # Conteos por tipo
        by_type = {}
        for task_type in EngineeringTaskType:
            count = len([t for t in all_tasks if t.task_type == task_type])
            if count > 0:
                by_type[task_type.value] = count

        # Tareas asignadas al usuario actual
        assigned_to_me = len([
            t for t in all_tasks
            if t.assigned_to_id == user_id and t.status != EngineeringTaskStatus.completed
        ]) if user_id else 0

        # Tareas críticas sin completar
        critical_count = len([
            t for t in all_tasks
            if t.priority == EngineeringTaskPriority.critical
            and t.status != EngineeringTaskStatus.completed
        ])

        return EngineeringTaskStatsResponse(
            total_tasks=total,
            by_status=by_status,
            by_priority=by_priority,
            by_type=by_type,
            assigned_to_me=assigned_to_me,
            critical_count=critical_count
        )
