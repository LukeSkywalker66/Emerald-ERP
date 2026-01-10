"""Router para WorkOrders - Endpoints de listado y ejecución para técnicos."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import String, cast, or_, text
from sqlalchemy.orm import Session, joinedload, selectinload, attributes

from src.database import get_db
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


from .work_orders_snapshot_helper import build_connection_snapshot
router = APIRouter(prefix="/v2/work-orders", tags=["work-orders"])


def get_user_id(request: Request) -> int:
    """Extract user_id from request state (set by middleware)."""
    return getattr(request.state, "user_id", 2)  # Fallback to admin user


def get_current_user(request: Request, db: Session = Depends(get_db), user_id: int = Depends(get_user_id)) -> User:
    """Obtiene el usuario actual con su rol para aplicar filtros automáticos."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


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

    # Filtro automático por rol
    if role_name == "technician":
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
    user_id: int = Depends(get_user_id),
):
    """Obtener detalles completos de una OT (para técnicos)."""
    wo = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.technician),
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
    user_id: int = Depends(get_user_id),
):
    """Actualizar estado de OT (usado por técnicos durante ejecución)."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    # Guardar estado anterior para logging
    old_status = wo.status
    
    # Actualizar campos
    update_data = payload.model_dump(exclude_unset=True)
    print(f"[DEBUG] Updating WO #{work_order_id} with data: {update_data}")
    
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
            author_id=user_id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id}: Estado actualizado de {old_status.value} a {payload.status.value}",
            meta_data={"work_order_id": wo.id, "old_status": old_status.value, "new_status": payload.status.value},
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
            author_id=user_id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id} Finalizada: {resolution_notes}",
            meta_data=meta_data,
        )
        db.add(timeline_event)
    
    db.commit()
    db.refresh(wo)
    
    print(f"[DEBUG] After refresh, WO #{work_order_id} photo_urls: {wo.photo_urls}, resolution_category: {wo.resolution_category}")
    
    return get_work_order_detail(work_order_id, db, user_id)


@router.post("/{work_order_id}/items", response_model=WorkOrderItemResponse, status_code=201)
def add_work_order_item(
    work_order_id: int,
    payload: WorkOrderItemCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
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
        author_id=user_id,
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
    user_id: int = Depends(get_user_id),
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
    user_id: int = Depends(get_user_id),
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
        author_id=user_id,
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
