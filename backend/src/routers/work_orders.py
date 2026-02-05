"""Router para WorkOrders - Endpoints de listado y ejecución para técnicos."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import String, cast, or_, text
from sqlalchemy.orm import Session, joinedload, selectinload, attributes

from src.database import get_db
from src.core.security import get_current_user
from src.models.tickets import (
    WorkOrder,
    WorkOrderItem,
    Ticket,
    TicketTimeline,
    TicketTimelineEventType,
    WorkOrderStatus,
    WorkOrderType,
)
from src.models.user import User
from src.schemas.tickets import (
    WorkOrderCreate,
    WorkOrderDetailResponse,
    WorkOrderUpdate,
    WorkOrderItemCreate,
    WorkOrderItemResponse,
    WorkOrderListResponse,
)
from src.schemas.contact_attempts import (
    ContactAttemptCreate,
    ContactAttemptResponse,
    ContactAttemptsStatsResponse,
)
from src.models.contact_attempts import ContactAttempt, ContactAttemptResult


from .work_orders_snapshot_helper import build_connection_snapshot
router = APIRouter(prefix="/v2/work-orders", tags=["work-orders"])


@router.post("", response_model=WorkOrderDetailResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear una nueva OT heredando datos del ticket asociado."""
    ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Crear snapshot de conexión (persistente para evitar re-queries)
    ticket_custom_data = getattr(ticket, "custom_data", {}) or {}
    connection_snapshot = build_connection_snapshot(db, ticket.connection_id)

    wo = WorkOrder(
        ticket_id=ticket.id,
        ot_type=payload.ot_type,
        status=WorkOrderStatus.pending_planning,
        technician_id=None,  # Sin asignar inicialmente
        notes=payload.description or payload.notes,
        custom_data={
            **ticket_custom_data,
            "priority": payload.priority or "medium",
            "client_id": getattr(ticket, "client_id", None),
            "connection_id": ticket.connection_id,
            "address": getattr(ticket, "address", None) or getattr(ticket, "availability_note", None),
            "connection": connection_snapshot,  # 🔥 Snapshot persistente
        },
    )
    db.add(wo)
    db.flush()

    # Registrar evento en timeline del ticket
    db.add(
        TicketTimeline(
            ticket_id=ticket.id,
            author_id=current_user.id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"Orden de trabajo generada ({payload.ot_type.value})",
            meta_data={
                "work_order_id": wo.id,
                "ot_type": payload.ot_type.value,
                "description": payload.description,
                "priority": payload.priority or "medium",
                "status": wo.status.value,
            },
        )
    )
    db.commit()
    db.refresh(wo)
    
    return get_work_order_detail(wo.id, db, current_user)


@router.get("", response_model=dict)
def list_work_orders(
    status: Optional[WorkOrderStatus] = Query(None, description="Estado de la OT"),
    date_range: Optional[str] = Query(None, description="Rango de fechas YYYY-MM-DD,YYYY-MM-DD"),
    mobile_unit_id: Optional[int] = Query(None, description="Técnico/Móvil asignado"),
    ot_type: Optional[str] = Query(None, description="Tipo de OT"),
    search: Optional[str] = Query(None, description="Buscar por ID o asunto"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listado de OTs con filtros automáticos según rol y filtros opcionales."""

    # Query base sin opciones pesadas (se aplican solo en el query de datos)
    base_query = db.query(WorkOrder)

    # Normalizamos el rol para evitar accesos repetidos a relaciones
    role_name = current_user.role.name if current_user.role else None

    # Filtro automático por rol (nombre en español: "tecnico")
    if role_name == "tecnico":
        base_query = base_query.filter(WorkOrder.technician_id == current_user.id)
    # Admin/Coordinator u otros roles ven todas

    # Filtros opcionales
    if status:
        base_query = base_query.filter(WorkOrder.status == status)

    if ot_type:
        try:
            ot_enum = WorkOrderType(ot_type)
            base_query = base_query.filter(WorkOrder.ot_type == ot_enum)
        except ValueError:
            pass

    if date_range:
        try:
            start_str, end_str = (date_range.split(",") + [None, None])[:2]
            if start_str:
                start_date = datetime.fromisoformat(start_str)
                base_query = base_query.filter(WorkOrder.scheduled_at >= start_date)
            if end_str:
                end_date = datetime.fromisoformat(end_str) + timedelta(days=1)
                base_query = base_query.filter(WorkOrder.scheduled_at < end_date)
        except ValueError:
            # Si el formato no es válido, ignoramos el filtro
            pass

    if mobile_unit_id and role_name != "technician":
        base_query = base_query.filter(WorkOrder.technician_id == mobile_unit_id)

    if search:
        pattern = f"%{search}%"
        base_query = (
            base_query.join(Ticket, isouter=True)
            .filter(
                or_(
                    cast(WorkOrder.id, String).ilike(pattern),
                    Ticket.subject.ilike(pattern),
                )
            )
            .distinct()
        )

    # Conteo ligero (solo IDs, sin joins extra de loaders)
    total = base_query.with_entities(WorkOrder.id).count()

    # Query de datos con loaders optimizados
    data_query = base_query.options(
        selectinload(WorkOrder.ticket).selectinload(Ticket.creator),
        selectinload(WorkOrder.technician),
    )

    work_orders = (
        data_query.order_by(WorkOrder.scheduled_at.asc().nulls_last(), WorkOrder.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    items = [_wo_to_list_response(wo, db).model_dump() for wo in work_orders]

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "pages": (total + limit - 1) // limit if limit else 0,
    }


@router.get("/{work_order_id}", response_model=WorkOrderDetailResponse)
def get_work_order_detail(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener detalles completos de una OT (para técnicos)."""
    wo = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.team),
            joinedload(WorkOrder.ticket),
            joinedload(WorkOrder.work_order_items),
        )
        .filter(WorkOrder.id == work_order_id)
        .first()
    )
    
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    # Construir ticket_info si existe, incluyendo cliente y dirección
    ticket_info = None
    if wo.ticket:
        # Datos básicos del ticket
        ticket_info = {
            "id": wo.ticket.id,
            "subject": wo.ticket.subject,
            "connection_id": wo.ticket.connection_id,
            "priority": wo.ticket.priority.value if wo.ticket.priority else None,
            "client_name": None,  # Se llenará desde conexión o fallback
            "address": getattr(wo.ticket, "availability_note", None),
        }

        # 1) Intentar con snapshot guardado en la OT (prioridad alta)
        conn_snap = (wo.custom_data or {}).get("connection") if wo.custom_data else None
        if conn_snap:
            ticket_info.update({
                "pppoe_username": conn_snap.get("pppoe_username"),
                "address": conn_snap.get("address") or ticket_info.get("address"),
                "client_name": conn_snap.get("client_name"),
                "client_dni": conn_snap.get("client_dni"),
                "node_name": conn_snap.get("node_name"),
                "node_ip": conn_snap.get("node_ip"),
                "plan_name": conn_snap.get("plan_name"),
                "plan_speed": conn_snap.get("plan_speed"),
            })
        # 2) Fallback: consultar DB si no hay snapshot y hay connection_id
        elif wo.ticket.connection_id:
            conn_row = db.execute(
                text(
                    """
                    SELECT 
                        c.connection_id,
                        c.pppoe_username,
                        COALESCE(c.direccion, cl.address) as address,
                        cl.name as client_name,
                        cl.doc_number as client_dni,
                        n.name as node_name,
                        n.ip_address as node_ip,
                        p.name as plan_name,
                        p.speed as plan_speed,
                        NULL::text as phone
                    FROM connections c
                    LEFT JOIN clientes cl ON c.customer_id = cl.id
                    LEFT JOIN nodes n ON c.node_id = n.node_id
                    LEFT JOIN plans p ON c.plan_id = p.plan_id
                    WHERE c.connection_id = :conn_id
                    LIMIT 1
                    """
                ),
                {"conn_id": wo.ticket.connection_id},
            ).first()

            if conn_row:
                ticket_info.update(
                    {
                        "pppoe_username": conn_row[1],
                        "address": conn_row[2] or ticket_info.get("address"),
                        "client_name": conn_row[3] or ticket_info.get("client_name"),
                        "client_dni": conn_row[4],
                        "node_name": conn_row[5],
                        "node_ip": conn_row[6],
                        "plan_name": conn_row[7],
                        "plan_speed": conn_row[8],
                        "contact_phone": conn_row[9],
                    }
                )

        # Fallback: intentar obtener teléfono de creador del ticket si no vino de conexión
        if not ticket_info.get("contact_phone"):
            creator_phone = None
            if wo.ticket and wo.ticket.creator:
                creator_phone = (
                    getattr(wo.ticket.creator, "phone", None)
                    or getattr(wo.ticket.creator, "mobile", None)
                    or getattr(wo.ticket.creator, "telefono", None)
                )
            if creator_phone:
                ticket_info["contact_phone"] = creator_phone
    
    return WorkOrderDetailResponse(
        id=wo.id,
        ticket_id=wo.ticket_id,
        ot_type=wo.ot_type,
        status=wo.status,
        technician_id=wo.technician_id,
        technician_name=wo.technician.full_name if wo.technician else None,
        
        # NUEVOS campos de coordinación
        team_id=wo.team_id,
        team_name=wo.team.name if wo.team else None,
        scheduled_start=wo.scheduled_start,
        scheduled_end=wo.scheduled_end,
        estimated_duration=wo.estimated_duration,
        coordination_notes=wo.coordination_notes,
        
        # Campos existentes
        scheduled_at=wo.scheduled_at,
        started_at=wo.started_at,
        completed_at=wo.completed_at,
        resolution_type=wo.resolution_type,
        resolution_notes=wo.resolution_notes,
        resolution_category=wo.resolution_category,
        photo_urls=wo.photo_urls,
        custom_data=wo.custom_data or {},
        notes=wo.notes,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
        items=[
            WorkOrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                serial_number=item.serial_number,
                notes=item.notes,
                created_at=item.created_at
            ) for item in wo.work_order_items
        ],
        ticket_info=ticket_info,
    )


@router.patch("/{work_order_id}", response_model=WorkOrderDetailResponse)
def update_work_order(
    work_order_id: int,
    payload: WorkOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar estado de OT (usado por técnicos Y coordinadores)."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    # Guardar estado anterior para logging
    old_status = wo.status
    
    # Actualizar campos
    update_data = payload.model_dump(exclude_unset=True)
    print(f"[DEBUG] Updating WO #{work_order_id} with data: {update_data}")
    
    # LÓGICA DE CÁLCULO AUTOMÁTICO DE scheduled_end
    if 'scheduled_start' in update_data or 'estimated_duration' in update_data:
        # Si se actualiza scheduled_start o estimated_duration, recalcular scheduled_end
        scheduled_start = update_data.get('scheduled_start', wo.scheduled_start)
        estimated_duration = update_data.get('estimated_duration', wo.estimated_duration)
        
        if scheduled_start and estimated_duration:
            # Calcular scheduled_end automáticamente
            calculated_end = scheduled_start + timedelta(minutes=estimated_duration)
            update_data['scheduled_end'] = calculated_end
            print(f"[DEBUG] Auto-calculated scheduled_end: {calculated_end}")
    
    # LÓGICA DE TRANSICIÓN DE ESTADOS AUTOMÁTICA
    # Si se asigna scheduled_start pero no hay team_id, pasar a "coordinated"
    if 'scheduled_start' in update_data and update_data.get('scheduled_start'):
        if not wo.team_id and 'team_id' not in update_data:
            update_data['status'] = WorkOrderStatus.coordinated
            print(f"[DEBUG] Auto-transition to COORDINATED (fecha sin cuadrilla)")
    
    # Si se asigna team_id y ya hay scheduled_start, pasar a "scheduled"
    if 'team_id' in update_data and update_data.get('team_id'):
        if wo.scheduled_start or update_data.get('scheduled_start'):
            update_data['status'] = WorkOrderStatus.scheduled
            print(f"[DEBUG] Auto-transition to SCHEDULED (fecha + cuadrilla)")
    
    # Aplicar actualizaciones
    for key, value in update_data.items():
        setattr(wo, key, value)
    
    # Flag modified para campos JSONB (photo_urls, custom_data)
    if 'photo_urls' in update_data:
        attributes.flag_modified(wo, "photo_urls")
    if 'custom_data' in update_data:
        attributes.flag_modified(wo, "custom_data")
    
    # Crear evento de timeline si cambia estado
    if payload.status and payload.status != old_status:
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=current_user.id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id}: Estado actualizado de {old_status.value} a {payload.status.value}",
            meta_data={
                "work_order_id": wo.id, 
                "old_status": old_status.value, 
                "new_status": payload.status.value,
                "team_id": wo.team_id,
                "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
            },
        )
        db.add(timeline_event)
    
    # Si se completa la OT, registrar en timeline con detalles de resolución
    if payload.completed_at and not wo.completed_at:
        resolution_notes = payload.resolution_notes or (payload.resolution_type.value if payload.resolution_type else "sin especificar")
        meta_data = {
            "work_order_id": wo.id,
            "resolution_type": payload.resolution_type.value if payload.resolution_type else None,
            "resolution_notes": resolution_notes,
            "resolution_category": payload.resolution_category.value if payload.resolution_category else None,
            "photo_count": len(payload.photo_urls) if payload.photo_urls else 0,
            "status": WorkOrderStatus.completed.value,
        }
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=current_user.id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id} Finalizada: {resolution_notes}",
            meta_data=meta_data,
        )
        db.add(timeline_event)
    
    db.commit()
    db.refresh(wo)
    
    print(f"[DEBUG] After refresh, WO #{work_order_id} photo_urls: {wo.photo_urls}, resolution_category: {wo.resolution_category}")
    
    return get_work_order_detail(work_order_id, db, current_user)


@router.post("/{work_order_id}/items", response_model=WorkOrderItemResponse, status_code=201)
def add_work_order_item(
    work_order_id: int,
    payload: WorkOrderItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agregar material consumido a una OT."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    item = WorkOrderItem(
        work_order_id=work_order_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        serial_number=payload.serial_number,
        notes=payload.notes,
    )
    db.add(item)
    
    # Evento de timeline
    serial_info = f" (SN: {payload.serial_number})" if payload.serial_number else ""
    timeline_event = TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"Material agregado a OT #{wo.id}: Producto {payload.product_id} x{payload.quantity}{serial_info}",
        meta_data={"work_order_id": wo.id, "product_id": payload.product_id, "quantity": payload.quantity},
    )
    db.add(timeline_event)
    
    db.commit()
    db.refresh(item)
    
    return WorkOrderItemResponse(
        id=item.id,
        product_id=item.product_id,
        quantity=item.quantity,
        serial_number=item.serial_number,
        notes=item.notes,
        created_at=item.created_at
    )


@router.delete("/{work_order_id}/items/{item_id}", status_code=204)
def remove_work_order_item(
    work_order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eliminar un item de material de una OT."""
    item = (
        db.query(WorkOrderItem)
        .filter(
            WorkOrderItem.id == item_id,
            WorkOrderItem.work_order_id == work_order_id,
        )
        .first()
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db.delete(item)
    db.commit()
    
    return None


@router.put("/{work_order_id}/reopen", response_model=WorkOrderDetailResponse)
@router.put("/{work_order_id}/reopen/", response_model=WorkOrderDetailResponse)
def reopen_work_order(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reabrir una OT finalizada.
    
    **Reglas de Negocio:**
    - **Admin:** Puede reabrir siempre
    - **Técnico asignado:** Solo dentro de las 2 horas posteriores al cierre
    - **Otros:** Prohibido
    
    **Acción:**
    - Resetea estado a IN_PROGRESS
    - Limpia completed_at, resolution_type, resolution_notes
    - Crea evento en timeline
    
    **Errores:**
    - 404: OT no existe
    - 403: Sin permisos o ventana expirada
    - 400: OT no está completada
    """
    # Cargar OT con relaciones
    wo = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.ticket),
        )
        .filter(WorkOrder.id == work_order_id)
        .first()
    )
    
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de Trabajo no encontrada"
        )
    
    # Validar que está completada
    if not wo.completed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La orden no está completada, no se puede reabrir"
        )
    
    # Obtener rol del usuario
    user_role = current_user.role.name if current_user.role else None
    is_admin = user_role in ["admin", "coordinator"]
    is_assigned_technician = wo.technician_id == user_id
    
    # Calcular tiempo transcurrido
    now = datetime.now(wo.completed_at.tzinfo) if wo.completed_at.tzinfo else datetime.utcnow()
    time_elapsed = now - wo.completed_at
    grace_period = timedelta(hours=2)
    within_grace_period = time_elapsed <= grace_period
    
    # Validación de permisos
    if is_admin:
        # Admin puede reabrir siempre
        pass
    elif is_assigned_technician and within_grace_period:
        # Técnico asignado dentro de ventana de gracia
        pass
    elif is_assigned_technician and not within_grace_period:
        # Técnico asignado pero fuera de ventana
        hours_elapsed = int(time_elapsed.total_seconds() / 3600)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"El tiempo de corrección ha expirado ({hours_elapsed}h desde el cierre). Contacte a administración."
        )
    else:
        # Ni admin ni técnico asignado
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para reabrir esta orden de trabajo"
        )
    
    # Guardar datos previos para auditoría
    old_resolution = wo.resolution_type.value if wo.resolution_type else "sin especificar"
    
    # Reabrir OT: resetear campos de finalización
    wo.status = WorkOrderStatus.in_progress
    wo.completed_at = None
    wo.resolution_type = None
    wo.resolution_notes = None
    
    # Crear evento en timeline
    timeline_event = TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"OT #{wo.id} reabierta para corrección (resolución previa: {old_resolution})",
        meta_data={
            "work_order_id": wo.id,
            "action": "reopen",
            "previous_resolution": old_resolution,
            "reopened_by": current_user.full_name or current_user.email,
            "reopened_by_role": user_role,
        },
    )
    db.add(timeline_event)
    
    db.commit()
    db.refresh(wo)
    
    # Retornar detalle actualizado
    return get_work_order_detail(work_order_id, db, user_id)


def _wo_to_list_response(wo: WorkOrder, db: Session) -> WorkOrderListResponse:
    """Construye la respuesta resumida para listado, enriquecida con datos de conexión."""
    ticket_title = wo.ticket.subject if wo.ticket else "Sin ticket"
    client_name = None
    if wo.ticket and wo.ticket.creator:
        client_name = wo.ticket.creator.full_name or wo.ticket.creator.email

    address = getattr(wo.ticket, "availability_note", None)

    # Enriquecer con datos de conexión si existe
    if wo.ticket and wo.ticket.connection_id:
        try:
            conn_row = db.execute(
                text(
                    """
                    SELECT 
                        c.connection_id,
                        c.pppoe_username,
                        COALESCE(c.direccion, cl.address) as address,
                        cl.name as client_name,
                        cl.doc_number as client_dni,
                        n.name as node_name,
                        n.ip_address as node_ip,
                        p.name as plan_name,
                        p.speed as plan_speed
                    FROM connections c
                    LEFT JOIN clientes cl ON c.customer_id = cl.id
                    LEFT JOIN nodes n ON c.node_id = n.node_id
                    LEFT JOIN plans p ON c.plan_id = p.plan_id
                    WHERE c.connection_id = :conn_id
                    LIMIT 1
                    """
                ),
                {"conn_id": wo.ticket.connection_id},
            ).first()

            if conn_row:
                # Actualizar con datos reales de conexión
                address = conn_row[2] or address  # conexión dirección
                client_name = conn_row[3] or client_name  # cliente real
        except Exception:
            # Si falla la consulta, usar datos fallback del ticket
            pass

    return WorkOrderListResponse(
        id=wo.id,
        ticket_id=wo.ticket_id,
        ticket_title=ticket_title,
        ot_type=wo.ot_type.value if wo.ot_type else "unknown",
        status=wo.status.value if wo.status else WorkOrderStatus.pending_planning.value,
        client_name=client_name or "Sin cliente",
        address=address or "-",
        technician_name=wo.technician.full_name if wo.technician else None,
        scheduled_at=wo.scheduled_at,
        started_at=wo.started_at,
        completed_at=wo.completed_at,
        created_at=wo.created_at,
    )


# ========== COORDINACIÓN / GRID ==========

from pydantic import BaseModel, Field, ConfigDict
from src.models.coordination import Team, TeamMember


class TeamLoadMetrics(BaseModel):
    """Métricas de carga para un equipo."""
    team_id: int
    team_name: str
    assigned_ots_count: int
    total_duration_minutes: int
    utilization_percentage: float
    available_capacity: int
    model_config = ConfigDict(from_attributes=True)


class CoordinationGridResponse(BaseModel):
    """Response del grid de coordinación."""
    teams: list = Field(default_factory=list)
    allocations: list = Field(default_factory=list)
    backlog: list = Field(default_factory=list)
    team_load: list[TeamLoadMetrics] = Field(default_factory=list)


def check_scheduling_conflicts(
    db: Session,
    team_id: int,
    scheduled_start: datetime,
    estimated_duration: int,
    exclude_work_order_id: Optional[int] = None,
) -> tuple:
    """
    Verificar colisión de horarios para un equipo.
    Retorna: (has_conflict: bool, conflicting_id: Optional[int])
    """
    if not estimated_duration:
        estimated_duration = 60
    
    scheduled_end = scheduled_start + timedelta(minutes=estimated_duration)
    
    query = db.query(WorkOrder).filter(
        WorkOrder.team_id == team_id,
        WorkOrder.status.in_([WorkOrderStatus.scheduled, WorkOrderStatus.in_progress]),
    )
    
    if exclude_work_order_id:
        query = query.filter(WorkOrder.id != exclude_work_order_id)
    
    existing = query.all()
    
    for wo in existing:
        if not wo.scheduled_start or not wo.scheduled_end:
            continue
        
        if scheduled_start < wo.scheduled_end and scheduled_end > wo.scheduled_start:
            return (True, wo.id)
    
    return (False, None)


@router.get("/coordination/grid", response_model=CoordinationGridResponse)
def get_coordination_grid(
    start_date: str = Query(..., description="Fecha inicio (YYYY-MM-DD)", regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: str = Query(..., description="Fecha fin (YYYY-MM-DD)", regex=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener datos del grid de coordinación con métricas de carga.
    
    **Params:**
    - start_date: YYYY-MM-DD
    - end_date: YYYY-MM-DD
    
    **Response:**
    - teams: Equipos activos con miembros
    - allocations: OTs asignadas en el rango
    - backlog: OTs sin asignar
    - team_load: Métricas de utilización
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        
        # Teams activos
        teams = db.query(Team).filter(Team.is_active == True)\
            .options(selectinload(Team.members)).all()
        
        teams_data = []
        for team in teams:
            teams_data.append({
                "id": team.id,
                "name": team.name,
                "members": [
                    {
                        "id": m.user.id,
                        "name": m.user.full_name or m.user.email,
                        "role": m.role.value if hasattr(m.role, 'value') else str(m.role),
                    }
                    for m in team.members
                ]
            })
        
        # Allocations (scheduled/in_progress en rango)
        allocations = db.query(WorkOrder)\
            .filter(
                WorkOrder.team_id.isnot(None),
                WorkOrder.status.in_([WorkOrderStatus.scheduled, WorkOrderStatus.in_progress]),
                WorkOrder.scheduled_start.isnot(None),
                WorkOrder.scheduled_start >= start,
                WorkOrder.scheduled_start <= end,
            )\
            .options(
                joinedload(WorkOrder.ticket),
                joinedload(WorkOrder.team)
            ).all()
        
        allocations_data = []
        for wo in allocations:
            allocations_data.append({
                "id": wo.id,
                "ticket_id": wo.ticket_id,
                "team_id": wo.team_id,
                "ot_type": wo.ot_type.value if wo.ot_type else "unknown",
                "status": wo.status.value if wo.status else "unknown",
                "client_name": wo.ticket.subject if wo.ticket else "S/N",
                "address": getattr(wo.ticket, "availability_note", None) or "-",
                "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
                "scheduled_end": wo.scheduled_end.isoformat() if wo.scheduled_end else None,
                "estimated_duration": wo.estimated_duration or 60,
                "coordination_notes": getattr(wo, "coordination_notes", None),
            })
        
        # Backlog (pending_planning o coordinated sin team)
        backlog = db.query(WorkOrder)\
            .filter(
                WorkOrder.team_id.is_(None),
                WorkOrder.status.in_([WorkOrderStatus.pending_planning, WorkOrderStatus.coordinated])
            )\
            .options(joinedload(WorkOrder.ticket)).all()
        
        backlog_data = []
        for wo in backlog:
            backlog_data.append({
                "id": wo.id,
                "ticket_id": wo.ticket_id,
                "team_id": None,
                "ot_type": wo.ot_type.value if wo.ot_type else "unknown",
                "status": wo.status.value if wo.status else "unknown",
                "client_name": wo.ticket.subject if wo.ticket else "S/N",
                "address": getattr(wo.ticket, "availability_note", None) or "-",
                "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
                "scheduled_end": wo.scheduled_end.isoformat() if wo.scheduled_end else None,
                "estimated_duration": wo.estimated_duration or 60,
                "coordination_notes": getattr(wo, "coordination_notes", None),
            })
        
        # Team Load Metrics
        WORKING_HOURS_PER_DAY = 10  # 8:00 a 18:00
        DAYS_IN_RANGE = max(1, (end - start).days)
        total_capacity = WORKING_HOURS_PER_DAY * 60 * DAYS_IN_RANGE
        
        team_load_data = []
        for team in teams:
            total_duration = sum(
                wo.estimated_duration or 0
                for wo in allocations
                if wo.team_id == team.id
            )
            
            ot_count = sum(1 for wo in allocations if wo.team_id == team.id)
            utilization = (total_duration / total_capacity * 100) if total_capacity > 0 else 0
            utilization = min(utilization, 100)
            
            team_load_data.append(
                TeamLoadMetrics(
                    team_id=team.id,
                    team_name=team.name,
                    assigned_ots_count=ot_count,
                    total_duration_minutes=total_duration,
                    utilization_percentage=round(utilization, 1),
                    available_capacity=max(0, total_capacity - total_duration),
                )
            )
        
        return CoordinationGridResponse(
            teams=teams_data,
            allocations=allocations_data,
            backlog=backlog_data,
            team_load=team_load_data,
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Formato de fecha inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener grid: {str(e)}")


@router.patch("/{work_order_id}/assign", response_model=dict)
def assign_work_order_to_team(
    work_order_id: int,
    payload: WorkOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Asignar OT a un Team con fecha/hora (desde Grid).
    
    **Request:**
    ```json
    {
        "team_id": 5,
        "scheduled_start": "2026-02-15T10:00:00Z",
        "estimated_duration": 60
    }
    ```
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id)\
        .options(joinedload(WorkOrder.ticket)).first()
    
    if not wo:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    
    if not payload.team_id or not payload.scheduled_start:
        raise HTTPException(status_code=400, detail="Requiere team_id y scheduled_start")
    
    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail=f"Team {payload.team_id} no existe")
    
    # Validar colisión
    estimated_duration = payload.estimated_duration or wo.estimated_duration or 60
    has_conflict, conflicting_id = check_scheduling_conflicts(
        db, payload.team_id, payload.scheduled_start, estimated_duration, work_order_id
    )
    
    if has_conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Conflicto de horarios: equipo tiene OT #{conflicting_id}"
        )
    
    # Actualizar
    wo.team_id = payload.team_id
    wo.scheduled_start = payload.scheduled_start
    wo.estimated_duration = estimated_duration
    wo.scheduled_end = payload.scheduled_start + timedelta(minutes=estimated_duration)
    wo.status = WorkOrderStatus.scheduled
    
    # Timeline
    db.add(TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"OT asignada a {team.name}",
        meta_data={
            "work_order_id": wo.id,
            "team_id": wo.team_id,
            "team_name": team.name,
            "scheduled_start": wo.scheduled_start.isoformat(),
        }
    ))
    
    db.commit()
    db.refresh(wo)
    
    return {
        "id": wo.id,
        "status": wo.status.value,
        "team_id": wo.team_id,
        "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
        "scheduled_end": wo.scheduled_end.isoformat() if wo.scheduled_end else None,
    }


@router.patch("/{work_order_id}/unassign", response_model=dict)
def unassign_work_order(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devolver OT al backlog (quitar team)."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id)\
        .options(joinedload(WorkOrder.ticket)).first()
    
    if not wo:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    
    old_team_id = wo.team_id
    old_team_name = wo.team.name if wo.team else "Unknown"
    
    wo.team_id = None
    wo.status = WorkOrderStatus.coordinated if wo.scheduled_start else WorkOrderStatus.pending_planning
    
    db.add(TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"OT desasignada de {old_team_name}",
        meta_data={
            "work_order_id": wo.id,
            "unassigned_team_id": old_team_id,
        }
    ))
    
    db.commit()
    db.refresh(wo)
    
    return {
        "id": wo.id,
        "status": wo.status.value,
        "team_id": None,
    }


# ========================================
# CONTACT ATTEMPTS - Intentos de Contacto
# ========================================

@router.post(
    "/{work_order_id}/contact-attempts",
    response_model=ContactAttemptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar intento de contacto",
    description="""
    Registra un intento de contacto telefónico con el cliente.
    
    Permite trackear:
    - Llamadas sin respuesta
    - Números ocupados
    - Contactos exitosos
    - Reprogramaciones solicitadas por el cliente
    
    Útil para auditoría y seguimiento del proceso de coordinación.
    """
)
def create_contact_attempt(
    work_order_id: int,
    payload: ContactAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registrar un nuevo intento de contacto para una OT."""
    
    # Verificar que la OT existe
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(
            status_code=404,
            detail=f"Work Order {work_order_id} not found"
        )
    
    # Crear el intento
    attempt = ContactAttempt(
        work_order_id=work_order_id,
        attempted_by=current_user.id,
        result=payload.result,
        phone_number=payload.phone_number,
        notes=payload.notes,
    )
    
    db.add(attempt)
    
    # Registrar en timeline del ticket (opcional pero útil)
    result_labels = {
        ContactAttemptResult.no_answer: "No contesta",
        ContactAttemptResult.busy: "Ocupado",
        ContactAttemptResult.wrong_number: "Número equivocado",
        ContactAttemptResult.voicemail: "Buzón de voz",
        ContactAttemptResult.successful: "Contacto exitoso",
        ContactAttemptResult.rescheduled: "Cliente solicita reprogramar",
        ContactAttemptResult.refused: "Cliente rechaza visita",
    }
    
    timeline_content = f"Intento de contacto: {result_labels.get(payload.result, payload.result)}"
    if payload.notes:
        timeline_content += f" - {payload.notes}"
    
    db.add(TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.note,
        content=timeline_content,
        meta_data={
            "work_order_id": work_order_id,
            "contact_attempt_id": None,  # Se actualizará después del flush
            "contact_result": payload.result.value,
            "phone_number": payload.phone_number,
        }
    ))
    
    db.commit()
    db.refresh(attempt)
    
    # Construir respuesta con nombre del coordinador
    response_data = ContactAttemptResponse.model_validate(attempt)
    if attempt.coordinator:
        response_data.coordinator_name = attempt.coordinator.username
    
    return response_data


@router.get(
    "/{work_order_id}/contact-attempts",
    response_model=list[ContactAttemptResponse],
    summary="Obtener historial de intentos de contacto",
    description="Lista todos los intentos de contacto realizados para una OT específica, ordenados por más reciente primero."
)
def get_contact_attempts(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener historial completo de intentos de contacto para una OT."""
    
    # Verificar que la OT existe
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(
            status_code=404,
            detail=f"Work Order {work_order_id} not found"
        )
    
    # Obtener todos los intentos
    attempts = db.query(ContactAttempt)\
        .filter(ContactAttempt.work_order_id == work_order_id)\
        .order_by(ContactAttempt.created_at.desc())\
        .all()
    
    # Construir respuestas con nombres de coordinadores
    results = []
    for attempt in attempts:
        response_data = ContactAttemptResponse.model_validate(attempt)
        if attempt.coordinator:
            response_data.coordinator_name = attempt.coordinator.username
        results.append(response_data)
    
    return results


@router.get(
    "/{work_order_id}/contact-attempts/stats",
    response_model=ContactAttemptsStatsResponse,
    summary="Obtener estadísticas de intentos de contacto",
    description="Retorna estadísticas agregadas: total de intentos, último intento y breakdown por tipo de resultado."
)
def get_contact_attempts_stats(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener estadísticas de intentos de contacto para una OT."""
    
    # Verificar que la OT existe
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(
            status_code=404,
            detail=f"Work Order {work_order_id} not found"
        )
    
    # Obtener todos los intentos
    attempts = db.query(ContactAttempt)\
        .filter(ContactAttempt.work_order_id == work_order_id)\
        .order_by(ContactAttempt.created_at.desc())\
        .all()
    
    # Calcular estadísticas
    total_attempts = len(attempts)
    last_attempt = None
    results_breakdown = {}
    
    if attempts:
        last_attempt_obj = attempts[0]
        last_attempt = ContactAttemptResponse.model_validate(last_attempt_obj)
        if last_attempt_obj.coordinator:
            last_attempt.coordinator_name = last_attempt_obj.coordinator.username
        
        # Contar por tipo de resultado
        for attempt in attempts:
            result_key = attempt.result.value
            results_breakdown[result_key] = results_breakdown.get(result_key, 0) + 1
    
    return ContactAttemptsStatsResponse(
        work_order_id=work_order_id,
        total_attempts=total_attempts,
        last_attempt=last_attempt,
        results_breakdown=results_breakdown,
    )
