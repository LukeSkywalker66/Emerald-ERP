"""Router para WorkOrders - Endpoints de listado y ejecución para técnicos."""
import logging
from decimal import Decimal
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import String, and_, cast, func, or_, select, text
from sqlalchemy.orm import Session, joinedload, selectinload, attributes

from src.database import get_db
from src.core.security import get_current_user
from src.utils.audit import log_create, log_update, get_entity_dict
from src.models.tickets import (
    WorkOrder,
    WorkOrderItem,
    WorkOrderUpdate as WorkOrderUpdateModel,
    Ticket,
    TicketTimeline,
    TicketTimelineEventType,
    WorkOrderStatus,
    WorkOrderType,
    ResolutionCategory,
)
from src.models.user import User
from src.models import Connection
from src.models.coordination import Team, TeamMember
from src.models.fleet import VehicleInspection
from src.schemas.tickets import (
    WorkOrderCreate,
    WorkOrderDetailResponse,
    WorkOrderUpdate,
    WorkOrderCompleteRequest,
    WorkOrderCancelRequest,
    WorkOrderItemCreate,
    WorkOrderItemResponse,
    WorkOrderListResponse,
    ConnectionNoteCreate,
    ConnectionNoteResponse,
    ConnectionAssetResponse,
    ConnectionAssetsListResponse,
    ConnectionNotesListResponse,
    WorkOrderRecoveryRequest,
    WorkOrderRecoveryResponse,
    WorkOrderUpdateCreate,
    WorkOrderUpdateResponse,
    WorkOrderUpdatesListResponse,
    WorkOrderUpdateStatusRequest,
    WorkOrderUpdatePendingResponse,
    WorkOrderUpdatePendingListResponse,
)
from src.schemas.contact_attempts import (
    ContactAttemptCreate,
    ContactAttemptResponse,
    ContactAttemptsStatsResponse,
)
from src.models.contact_attempts import ContactAttempt, ContactAttemptResult
from src.services.work_order_service import create_work_order_for_ticket
from src.services.wo_completion_service import (
    complete_work_order_with_inventory,
    CompletionError,
    _get_work_order_warehouse_id,
    _process_item,
    reverse_material_item,
)
from src.models.inventory import (
    ConnectionAsset,
    ConnectionNote,
    ConnectionAssetStatus,
    Product,
    SerialItem,
    SerialItemStatus,
    StockBulk,
    StockMovement,
    MovementType,
)

logger = logging.getLogger(__name__)


from .work_orders_guards import (
    validate_coordination_not_locked,
    get_coordination_options_for_incomplete_work_order,
    validate_ticket_for_work_order,
)
router = APIRouter(tags=["work-orders"])


@router.post("", response_model=WorkOrderDetailResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear una nueva OT heredando datos del ticket asociado."""
    ticket = validate_ticket_for_work_order(payload.ticket_id, db)
    try:
        wo = create_work_order_for_ticket(
            db,
            ticket=ticket,
            author_id=current_user.id,
            ot_type=payload.ot_type,
            priority=payload.priority,
            operational_instruction=payload.operational_instruction,
            description=payload.description,
            notes=payload.notes,
            latitude=payload.latitude,
            longitude=payload.longitude,
            timeline_meta_extra={"source": "work_orders_router"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    db.commit()
    db.refresh(wo)
    
    # 🔒 AUDIT LOG: Registrar creación de OT
    try:
        log_create(
            db=db,
            user_id=current_user.id,
            entity_name="work_orders",
            entity_id=wo.id,
            new_values={
                "ticket_id": wo.ticket_id,
                "ot_type": wo.ot_type.value,
                "status": wo.status.value,
                "priority": payload.priority or "medium"
            }
        )
    except Exception as audit_error:
        logging.getLogger("uvicorn.error").error(f"❌ [AUDIT] Error al registrar creación de OT {wo.id}: {audit_error}")
    
    return get_work_order_detail(wo.id, db, current_user)


@router.get("", response_model=dict)
def list_work_orders(
    status: Optional[WorkOrderStatus] = Query(None, description="Estado de la OT"),
    date_range: Optional[str] = Query(None, description="Rango de fechas YYYY-MM-DD,YYYY-MM-DD"),
    mobile_unit_id: Optional[int] = Query(None, description="Técnico/Móvil asignado"),
    ot_type: Optional[str] = Query(None, description="Tipo de OT"),
    search: Optional[str] = Query(None, description="Buscar por ID o asunto"),
    team_id: Optional[int] = Query(None, description="Filtrar por cuadrilla"),
    unassigned: Optional[bool] = Query(None, description="Solo OTs sin cuadrilla ni técnico"),
    assigned: Optional[bool] = Query(None, description="Solo OTs con cuadrilla o técnico"),
    order_by: str = Query("created_at", description="Campo de orden: created_at | scheduled_at | id"),
    order_dir: str = Query("desc", description="asc | desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listado de OTs con filtros automáticos según rol y filtros opcionales."""

    # Query base sin opciones pesadas (se aplican solo en el query de datos)
    base_query = db.query(WorkOrder)

    # Filtro automático por capability (backend authority):
    # - `work_orders.view_all` (o `*`) → ve todas.
    # - si no → técnico de campo: sus propias OT + las de sus cuadrillas
    #   (conserva la agenda del día y su historial en un solo listado paginado).
    from src.core.security import build_capabilities
    caps = build_capabilities(current_user)
    if "work_orders.view_all" not in caps and "*" not in caps:
        team_ids_stmt = (
            select(TeamMember.team_id)
            .where(TeamMember.user_id == current_user.id)
            .distinct()
        )
        team_ids = list(db.scalars(team_ids_stmt).all())
        scope_conditions = [WorkOrder.technician_id == current_user.id]
        if team_ids:
            scope_conditions.append(WorkOrder.team_id.in_(team_ids))
        base_query = base_query.filter(or_(*scope_conditions))

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

    # Filtro por técnico/móvil: aplica a cualquier usuario con visión de todas
    # las OTs. Para un técnico de campo (sin `work_orders.view_all`), el filtro
    # automático de arriba ya restringe a sus propias OTs, así que este filtro
    # solo acota más (no hay escalada de privilegios).
    if mobile_unit_id:
        base_query = base_query.filter(WorkOrder.technician_id == mobile_unit_id)

    if team_id:
        base_query = base_query.filter(WorkOrder.team_id == team_id)

    if unassigned is True:
        base_query = base_query.filter(
            WorkOrder.team_id.is_(None),
            WorkOrder.technician_id.is_(None),
        )

    if assigned is True:
        base_query = base_query.filter(
            or_(
                WorkOrder.team_id.is_not(None),
                WorkOrder.technician_id.is_not(None),
            )
        )

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
        selectinload(WorkOrder.team),
    )

    # Orden por defecto: fecha de creación descendente (lo más nuevo arriba).
    order_columns = {
        "created_at": WorkOrder.created_at,
        "scheduled_at": WorkOrder.scheduled_at,
        "id": WorkOrder.id,
    }
    order_col = order_columns.get(order_by, WorkOrder.created_at)
    order_expr = (
        order_col.asc().nulls_last()
        if order_dir.lower() == "asc"
        else order_col.desc().nulls_last()
    )

    work_orders = (
        data_query.order_by(order_expr, WorkOrder.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    items = [_wo_to_list_response(wo, db) for wo in work_orders]

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "pages": (total + limit - 1) // limit if limit else 0,
    }


@router.get("/my-schedule", response_model=list[dict])
def get_my_schedule(
    date_param: Optional[date] = Query(
        default=None,
        alias="date",
        description="Fecha a consultar (YYYY-MM-DD). Si no viene, usa hoy.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agenda diaria de OTs para equipos activos del usuario.
    
    Retorna las OTs programadas para los equipos (cuadrillas) en los que
    el usuario es miembro activo, filtradas por fecha.
    
    Útil para técnicos en calle que necesitan ver su agenda del día.
    """
    target_date = date_param or datetime.utcnow().date()
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    # 1) Obtener team_ids donde el usuario es miembro
    team_ids_stmt = (
        select(TeamMember.team_id)
        .where(TeamMember.user_id == current_user.id)
        .distinct()
    )
    team_ids = list(db.scalars(team_ids_stmt).all())

    if not team_ids:
        return []

    # 2) OTs del equipo filtradas por fecha programada
    # Soporte para scheduled_start (nuevo) y fallback a scheduled_at (legacy)
    work_orders_stmt = (
        select(WorkOrder)
        .where(
            WorkOrder.team_id.in_(team_ids),
            or_(
                and_(
                    WorkOrder.scheduled_start.is_not(None),
                    WorkOrder.scheduled_start >= day_start,
                    WorkOrder.scheduled_start < day_end,
                ),
                and_(
                    WorkOrder.scheduled_start.is_(None),
                    WorkOrder.scheduled_at.is_not(None),
                    WorkOrder.scheduled_at >= day_start,
                    WorkOrder.scheduled_at < day_end,
                ),
            ),
        )
        .options(
            joinedload(WorkOrder.ticket).joinedload(Ticket.creator),
            joinedload(WorkOrder.team),
            joinedload(WorkOrder.technician),
        )
        .order_by(
            WorkOrder.scheduled_start.asc().nulls_last(),
            WorkOrder.scheduled_at.asc().nulls_last(),
            WorkOrder.id.asc(),
        )
    )

    work_orders = list(db.scalars(work_orders_stmt).unique().all())

    # 3) Reusar serializador enriquecido existente
    return [_wo_to_list_response(wo, db) for wo in work_orders]


# ==================== EQUIPOS BLOQUEADOS (ANTES DE /{work_order_id}) ====================

@router.get(
    "/my-pending-closure",
    response_model=list[dict],
    summary="Obtener OTs vencidas pendientes de cierre (Equipos Bloqueados)",
    description="Retorna OTs con status 'pending_closure' asignadas a los equipos del técnico autenticado. El técnico debe cerrar estas OTs con fotos/materiales antes de recibir nuevas asignaciones."
)
def get_my_pending_closure(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Equipos Bloqueados: Obtener OTs vencidas que bloquean la agenda del técnico.
    
    Criterios:
    - status = 'pending_closure'
    - Asignadas a equipos donde el usuario es miembro activo
    
    El técnico NO puede recibir nuevas OTs hasta que cierre estas con:
    - Fotos obligatorias
    - Materiales utilizados
    - Motivo de cierre (éxito/fallo)
    """
    
    # 1) Obtener team_ids donde el usuario es miembro
    team_ids_stmt = (
        select(TeamMember.team_id)
        .where(TeamMember.user_id == current_user.id)
        .distinct()
    )
    team_ids = list(db.scalars(team_ids_stmt).all())
    
    if not team_ids:
        return []
    
    # 2) Buscar OTs con status 'pending_closure' asignadas a esos equipos
    work_orders_stmt = (
        select(WorkOrder)
        .where(
            WorkOrder.team_id.in_(team_ids),
            WorkOrder.status == WorkOrderStatus.pending_closure
        )
        .options(
            joinedload(WorkOrder.ticket).joinedload(Ticket.creator),
            joinedload(WorkOrder.team),
            joinedload(WorkOrder.technician),
        )
        .order_by(
            WorkOrder.scheduled_start.asc().nulls_last(),
            WorkOrder.id.asc()
        )
    )
    
    work_orders = list(db.scalars(work_orders_stmt).unique().all())
    
    # 3) Reusar serializador enriquecido existente
    return [_wo_to_list_response(wo, db) for wo in work_orders]


@router.get(
    "/coordination/pending-closure-stats",
    response_model=dict,
    summary="Estadísticas de OTs en pending_closure para coordinación",
    description="Retorna métricas de OTs vencidas sin cerrar, agrupadas por equipo. Crítico para identificar técnicos bloqueados y re-asignaciones urgentes."
)
def get_pending_closure_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard de Equipos Bloqueados para coordinadores.
    
    Retorna:
    - Cantidad total de OTs en pending_closure
    - Breakdown por equipo (team_id, nombre, cantidad de OTs bloqueadas)
    - OTs más antiguas (mayor tiempo vencido)
    
    Permite al coordinador:
    - Identificar equipos bloqueados (no pueden recibir nuevas OTs)
    - Priorizar seguimiento con técnicos para cierre
    - Re-asignar OTs si es necesario
    """
    
    # 1) Contar total de OTs en pending_closure
    total_pending = db.query(WorkOrder).filter(
        WorkOrder.status == WorkOrderStatus.pending_closure
    ).count()
    
    # 2) Breakdown por equipo
    team_breakdown_stmt = (
        select(
            WorkOrder.team_id,
            Team.name,
            func.count(WorkOrder.id).label("pending_count")
        )
        .join(Team, WorkOrder.team_id == Team.id)
        .where(WorkOrder.status == WorkOrderStatus.pending_closure)
        .group_by(WorkOrder.team_id, Team.name)
        .order_by(func.count(WorkOrder.id).desc())
    )
    
    team_breakdown = [
        {
            "team_id": row.team_id,
            "team_name": row.name,
            "pending_count": row.pending_count
        }
        for row in db.execute(team_breakdown_stmt).all()
    ]
    
    # 3) OTs más antiguas (top 10 por fecha programada original)
    oldest_orders_stmt = (
        select(WorkOrder)
        .where(WorkOrder.status == WorkOrderStatus.pending_closure)
        .options(
            joinedload(WorkOrder.ticket),
            joinedload(WorkOrder.team),
            joinedload(WorkOrder.technician),
        )
        .order_by(WorkOrder.scheduled_start.asc().nulls_last())
        .limit(10)
    )
    
    oldest_orders = list(db.scalars(oldest_orders_stmt).unique().all())
    oldest_orders_data = [_wo_to_list_response(wo, db) for wo in oldest_orders]
    
    return {
        "total_pending_closure": total_pending,
        "team_breakdown": team_breakdown,
        "oldest_orders": oldest_orders_data,
        "blocked_teams_count": len(team_breakdown),
        "pattern": "Equipos Bloqueados"
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
            "description": wo.ticket.description,
            "connection_id": wo.ticket.connection_id,
            "priority": wo.ticket.priority.value if wo.ticket.priority else None,
            "category_name": wo.ticket.category.name if wo.ticket.category else None,
            "reason_name": wo.ticket.reason.name if wo.ticket.reason else None,
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
                "vlans": conn_snap.get("vlans"),
                "plan_name": conn_snap.get("plan_name"),
                "plan_speed": conn_snap.get("plan_speed"),
                "address_parts": conn_snap.get("address_parts"),
            })
        # 2) Fallback: consultar DB si no hay snapshot y hay connection_id.
        #    Instalaciones/traslados usan destination/origin_connection_id.
        elif (wo.ticket.connection_id or wo.ticket.destination_connection_id or wo.ticket.origin_connection_id):
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
                        n.vlans as vlans,
                        p.name as plan_name,
                        p.speed as plan_speed,
                        c.address_parts,
                        COALESCE(
                            ct.number,
                            cl.raw_data->>'phone',
                            cl.raw_data->>'mobile',
                            cl.raw_data->>'telefono'
                        ) as phone
                    FROM connections c
                    LEFT JOIN clientes cl ON c.customer_id = cl.id
                    LEFT JOIN LATERAL (
                        SELECT ct_inner.number
                        FROM clientes_telefonos ct_inner
                        WHERE ct_inner.customer_id = cl.id
                          AND ct_inner.number IS NOT NULL
                          AND btrim(ct_inner.number) <> ''
                        ORDER BY ct_inner.id ASC
                        LIMIT 1
                    ) ct ON true
                    LEFT JOIN nodes n ON c.node_id = n.node_id
                    LEFT JOIN plans p ON c.plan_id = p.plan_id
                    WHERE c.connection_id = :conn_id
                    LIMIT 1
                    """
                ),
                {"conn_id": wo.ticket.connection_id or wo.ticket.destination_connection_id or wo.ticket.origin_connection_id},
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
                        "vlans": conn_row[7],
                        "plan_name": conn_row[8],
                        "plan_speed": conn_row[9],
                        "address_parts": conn_row[10],
                        "contact_phone": conn_row[11],
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
    
    # Obtener nombres de productos para los items
    product_ids = list(set(item.product_id for item in wo.work_order_items))
    products_map = {}
    if product_ids:
        for p in db.query(Product).filter(Product.id.in_(product_ids)).all():
            products_map[p.id] = p.name
    
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
        cancelled_at=wo.cancelled_at,
        resolution_type=wo.resolution_type,
        resolution_notes=wo.resolution_notes,
        resolution_category=wo.resolution_category,
        photo_urls=wo.photo_urls,
        latitude=wo.latitude,
        longitude=wo.longitude,
        custom_data=wo.custom_data or {},
        notes=wo.notes,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
        items=[
            WorkOrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=products_map.get(item.product_id, f"Producto #{item.product_id}"),
                quantity=item.quantity,
                serial_number=item.serial_number,
                notes=item.notes,
                warehouse_id=item.warehouse_id,
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
    """
    Actualizar estado de OT (usado por técnicos Y coordinadores).
    
    **Validaciones (NASA-grade):**
    - OTs completadas/fallidas son inmutables (no se pueden editar)
    - Técnico puede marcar como "no completada" dentro de 2 horas
    - Coordinador puede reprogramar OTs no iniciadas
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    # Capturar valores anteriores para auditoría
    old_values = {
        "status": wo.status.value,
        "team_id": wo.team_id,
        "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
        "estimated_duration": wo.estimated_duration,
        "latitude": float(wo.latitude) if wo.latitude is not None else None,
        "longitude": float(wo.longitude) if wo.longitude is not None else None,
    }
    
    # Guardar estado anterior para logging
    old_status = wo.status
    
    # ===== VALIDACIÓN: BLOQUEAR EDICIONES DE OTs FINALIZADAS / CANCELADAS =====
    # Exception: permitir operación "reopen" (marcar como incompleta) - eso es via endpoint separado
    # Solo mostrar acceso si es técnico intentando reopens dentro de ventana de gracia
    if wo.status in (WorkOrderStatus.completed, WorkOrderStatus.failed, WorkOrderStatus.cancelled):
        is_cancelled = wo.status == WorkOrderStatus.cancelled
        detail = (
            f"Orden de trabajo no puede ser modificada. Estado: {wo.status.value} (inmutable)."
            + (" La OT fue cancelada y no se puede reactivar."
               if is_cancelled
               else f" Use PUT /work-orders/{work_order_id}/reopen para marcar como incompleta.")
        )
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=detail,
            headers={
                "X-Locked-Reason": "LOCKED_CANCELLED" if is_cancelled else "LOCKED_COMPLETED",
                "X-Work-Order-Status": wo.status.value,
            }
        )
    
    # ===== VALIDACIÓN: BLOQUEAR EDICIONES DE OTs CON FECHA PASADA =====
    # Si la OT fue programada para el pasado (+ grace de 5 min), no se puede editar
    # EXCEPCIÓN 1: Si está en 'coordinated' (no iniciada), permitir cambios de prioridad/duración
    # porque el técnico aún no comenzó y el coordinador puede necesitar ajustar
    # EXCEPCIÓN 2: CRÍTICA - Permitir SIEMPRE el cierre/completion de OTs atrasadas
    # (el técnico debe poder reportar el cierre aunque el trabajo sea de ayer)
    now = datetime.now(timezone.utc)
    grace_period = timedelta(minutes=5)
    
    # Asegurar que wo.scheduled_start tenga timezone para comparar
    scheduled_start_aware = wo.scheduled_start
    if wo.scheduled_start and wo.scheduled_start.tzinfo is None:
        scheduled_start_aware = wo.scheduled_start.replace(tzinfo=timezone.utc)
    
    # Estados finales que SIEMPRE deben permitirse aunque haya fecha pasada
    final_states = {WorkOrderStatus.completed, WorkOrderStatus.failed}
    target_final_state = payload.status in final_states if payload.status else False
    
    if scheduled_start_aware and scheduled_start_aware < now - grace_period:
        # Si está en progreso y tiene fecha pasada, bloquear SOLO si NO intenta cerrar/completar.
        # EXCEPCIONES:
        # - INICIAR (in_progress) una OT vencida que todavía no arrancó
        #   (scheduled/assigned/pending_closure) para que el contador registre el tiempo.
        # - Actualizar SOLO la geolocalización (lat/lng), que el técnico debe poder
        #   registrar aunque la OT esté vencida.
        update_fields = payload.model_dump(exclude_unset=True)
        is_location_only = bool(update_fields) and set(update_fields.keys()).issubset(
            {"latitude", "longitude"}
        )
        allow_start_overdue = (
            payload.status == WorkOrderStatus.in_progress
            and wo.status in [
                WorkOrderStatus.scheduled,
                WorkOrderStatus.assigned,
                WorkOrderStatus.pending_closure,
            ]
        )
        if wo.status not in [WorkOrderStatus.pending_planning, WorkOrderStatus.coordinated]:
            if not target_final_state and not allow_start_overdue and not is_location_only:
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Orden programada para {scheduled_start_aware.strftime('%d/%m %H:%M')}. No se puede editar OTs con fecha pasada.",
                    headers={
                        "X-Locked-Reason": "LOCKED_PAST_DATE",
                        "X-Scheduled-Start": scheduled_start_aware.isoformat(),
                    }
                )

    # ===== HARDENING: INSPECCIÓN DIARIA OBLIGATORIA PARA OPERAR =====
    # Solo aplica a técnicos cuando intentan pasar a estado activo (in_progress)
    role_name = (current_user.role.name.lower() if current_user.role and current_user.role.name else "")
    target_status = payload.status.value if payload.status else None
    is_activation_attempt = target_status in {"in_progress", "en_camino", "on_the_way"}

    if role_name in {"tecnico", "technician"} and is_activation_attempt:
        # 1) Determinar vehículo operativo asociado a la OT del técnico
        team_id_for_check = payload.team_id if payload.team_id is not None else wo.team_id
        vehicle_id = None

        if team_id_for_check:
            team = db.query(Team).filter(Team.id == team_id_for_check).first()
            vehicle_id = team.vehicle_id if team else None
        else:
            # Fallback: primera cuadrilla del técnico con vehículo asignado
            member_with_vehicle = (
                db.query(TeamMember)
                .join(Team, TeamMember.team_id == Team.id)
                .filter(
                    TeamMember.user_id == current_user.id,
                    Team.vehicle_id.is_not(None),
                )
                .first()
            )
            if member_with_vehicle:
                team = db.query(Team).filter(Team.id == member_with_vehicle.team_id).first()
                vehicle_id = team.vehicle_id if team else None

        # Si trabaja a pie (sin vehículo), no bloquear
        if vehicle_id is not None:
            inspection_exists = (
                db.query(VehicleInspection.id)
                .filter(
                    VehicleInspection.vehicle_id == vehicle_id,
                    VehicleInspection.inspection_date == date.today(),
                )
                .first()
            )

            if not inspection_exists:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Operación denegada: Debe completar la inspección diaria del vehículo antes de iniciar una tarea.",
                )

    # ===== REGLA DE NEGOCIO: UNA SOLA TAREA EN CURSO POR CUADRILLA =====
    # Solo aplica al ACTIVAR una tarea (pasar a in_progress). Si la cuadrilla ya
    # tiene otra OT en curso, se bloquea el inicio para evitar tareas simultáneas.
    if (
        payload.status == WorkOrderStatus.in_progress
        and wo.status != WorkOrderStatus.in_progress
    ):
        team_id_for_check = payload.team_id if payload.team_id is not None else wo.team_id
        if team_id_for_check:
            blocking = (
                db.query(WorkOrder)
                .filter(
                    WorkOrder.team_id == team_id_for_check,
                    WorkOrder.status == WorkOrderStatus.in_progress,
                    WorkOrder.id != work_order_id,
                )
                .order_by(WorkOrder.started_at.asc().nulls_last(), WorkOrder.id.asc())
                .all()
            )
            if blocking:
                # Incluir la(s) OT que bloquea(n) para que el técnico sepa cuál cerrar.
                labels = []
                for blocker in blocking[:3]:
                    subject = blocker.ticket.subject if blocker.ticket else ""
                    labels.append(f"OT #{blocker.id}" + (f" ({subject})" if subject else ""))
                extra = f" (+{len(blocking) - 3} más)" if len(blocking) > 3 else ""
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "No podés iniciar esta tarea hasta completar/cerrar: "
                        + ", ".join(labels)
                        + extra
                        + "."
                    ),
                )

    # Actualizar campos
    update_data = payload.model_dump(exclude_unset=True)
    
    # LÓGICA DE CÁLCULO AUTOMÁTICO DE scheduled_end
    if 'scheduled_start' in update_data or 'estimated_duration' in update_data:
        # Si se actualiza scheduled_start o estimated_duration, recalcular scheduled_end
        scheduled_start = update_data.get('scheduled_start', wo.scheduled_start)
        estimated_duration = update_data.get('estimated_duration', wo.estimated_duration)
        
        if scheduled_start and estimated_duration:
            # Calcular scheduled_end automáticamente
            calculated_end = scheduled_start + timedelta(minutes=estimated_duration)
            update_data['scheduled_end'] = calculated_end
    
    # LÓGICA DE TRANSICIÓN DE ESTADOS AUTOMÁTICA
    # Si se asigna scheduled_start pero no hay team_id, pasar a "coordinated"
    if 'scheduled_start' in update_data and update_data.get('scheduled_start'):
        if not wo.team_id and 'team_id' not in update_data:
            update_data['status'] = WorkOrderStatus.coordinated
    
    # Si se asigna team_id y ya hay scheduled_start, pasar a "scheduled"
    if 'team_id' in update_data and update_data.get('team_id'):
        if wo.scheduled_start or update_data.get('scheduled_start'):
            update_data['status'] = WorkOrderStatus.scheduled
    
    # Aplicar actualizaciones
    for key, value in update_data.items():
        setattr(wo, key, value)

    # G4: write-through de geolocalización hacia la conexión (fuente de verdad).
    # Cuando se guarda una ubicación y la OT está ligada a una conexión, se graba
    # también en connections.lat/lng (lo usan técnicos y coordinación por igual).
    if 'latitude' in update_data or 'longitude' in update_data:
        effective_conn_id = (
            wo.ticket.connection_id
            or wo.ticket.destination_connection_id
            or wo.ticket.origin_connection_id
        ) if wo.ticket else None
        if effective_conn_id and (wo.latitude is not None or wo.longitude is not None):
            conn = db.query(Connection).filter(
                Connection.connection_id == effective_conn_id
            ).first()
            if conn:
                # Se persiste como Decimal (sin pérdida de precisión por float) y
                # de forma null-safe: si el valor es inválido, no se pisa nada.
                if wo.latitude is not None:
                    try:
                        conn.latitude = Decimal(str(wo.latitude))
                    except Exception:
                        pass
                if wo.longitude is not None:
                    try:
                        conn.longitude = Decimal(str(wo.longitude))
                    except Exception:
                        pass
    
    # Flag modified para campos JSONB (photo_urls, custom_data)
    if 'photo_urls' in update_data:
        attributes.flag_modified(wo, "photo_urls")
    if 'custom_data' in update_data:
        attributes.flag_modified(wo, "custom_data")
    
    # Crear evento de timeline si cambia estado (con etiquetas en español)
    STATUS_LABELS = {
        "pending_planning": "Pendiente",
        "assigned": "Asignada",
        "in_progress": "En Progreso",
        "pending_closure": "Pendiente Cierre",
        "completed": "Completada",
        "failed": "Fallida",
        "scheduled": "Programada",
        "backlog": "Backlog",
        "testing": "Testing",
        "rejected": "Rechazada",
    }
    if payload.status and payload.status != old_status:
        old_label = STATUS_LABELS.get(old_status.value, old_status.value)
        new_label = STATUS_LABELS.get(payload.status.value, payload.status.value)
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=current_user.id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id}: Estado actualizado de {old_label} a {new_label}",
            meta_data={
                "work_order_id": wo.id,
                "old_status": old_status.value,
                "new_status": payload.status.value,
                "team_id": wo.team_id,
                "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
            },
        )
        db.add(timeline_event)
    
    # Si se completa la OT, registrar en timeline con detalles de resolución y cuadrilla
    if payload.completed_at and not wo.completed_at:
        resolution_notes = payload.resolution_notes or (payload.resolution_type.value if payload.resolution_type else "sin especificar")
        
        # Obtener miembros de la cuadrilla asignada al momento de finalización
        team_members_info = []
        if wo.team_id:
            from src.models.coordination import TeamMember
            members = db.query(TeamMember).filter(
                TeamMember.team_id == wo.team_id
            ).all()
            for m in members:
                member_name = m.user.full_name if m.user and m.user.full_name else (m.user.username if m.user else f"ID:{m.user_id}")
                team_members_info.append(f"{member_name} ({m.role})")
        
        team_str = f"Cuadrilla: {', '.join(team_members_info)}" if team_members_info else ""
        full_content = f"OT #{wo.id} Finalizada: {resolution_notes}"
        if team_str:
            full_content += f" | {team_str}"
        
        meta_data = {
            "work_order_id": wo.id,
            "resolution_type": payload.resolution_type.value if payload.resolution_type else None,
            "resolution_notes": resolution_notes,
            "resolution_category": payload.resolution_category.value if payload.resolution_category else None,
            "photo_count": len(payload.photo_urls) if payload.photo_urls else 0,
            "status": WorkOrderStatus.completed.value,
            "team_id": wo.team_id,
            "team_members": team_members_info,
        }
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=current_user.id,
            event_type=TicketTimelineEventType.ot_event,
            content=full_content,
            meta_data=meta_data,
        )
        db.add(timeline_event)
    
    db.commit()
    db.refresh(wo)
    
    # 🔒 AUDIT LOG: Registrar actualización de OT
    try:
        log_update(
            db=db,
            user_id=current_user.id,
            entity_name="work_orders",
            entity_id=wo.id,
            old_values=old_values,
            new_values={
                "status": wo.status.value,
                "team_id": wo.team_id,
                "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
                "estimated_duration": wo.estimated_duration,
                "latitude": float(wo.latitude) if wo.latitude is not None else None,
                "longitude": float(wo.longitude) if wo.longitude is not None else None,
            }
        )
    except Exception as audit_error:
        logging.getLogger("uvicorn.error").error(f"❌ [AUDIT] Error al registrar actualización de OT {wo.id}: {audit_error}")
    
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

    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if product.type == "SERIALIZED":
        if not payload.serial_number:
            raise HTTPException(
                status_code=422,
                detail="Los productos serializados requieren serial_number",
            )
        if not product.is_composite and payload.quantity != 1:
            raise HTTPException(
                status_code=422,
                detail="Los serializados no compuestos deben consumirse con cantidad 1",
            )
        # Anti-duplicados: un activo serializado no puede cargarse dos veces en la
        # misma OT (evita el fallo "ya está instalado en otra conexión" al cerrar).
        duplicate = (
            db.query(WorkOrderItem)
            .filter(
                WorkOrderItem.work_order_id == work_order_id,
                WorkOrderItem.serial_number == payload.serial_number,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=422,
                detail=f"El serial {payload.serial_number} ya está cargado en esta OT",
            )
    elif product.type == "BULK":
        if payload.quantity <= 0:
            raise HTTPException(status_code=422, detail="La cantidad debe ser mayor a 0")

    # Resolver el depósito canónico en backend con la MISMA función que usa el cierre.
    # Así el item queda atado al depósito exacto desde el que se descontará stock,
    # eliminando la deriva entre la validación en alta y el descuento en el cierre.
    canonical_warehouse_id = _get_work_order_warehouse_id(db, wo, current_user.id)

    # Si el frontend declaró un depósito distinto, visibilizamos la deriva en lugar de
    # descartarla silenciosamente (422 explícito para corregir la resolución del frontend).
    if payload.warehouse_id is not None and payload.warehouse_id != canonical_warehouse_id:
        raise HTTPException(
            status_code=422,
            detail=(
                f"El depósito declarado ({payload.warehouse_id}) no coincide con el depósito "
                f"de la cuadrilla de la OT ({canonical_warehouse_id}). Recargá la OT y volvé a intentar."
            ),
        )

    item = WorkOrderItem(
        work_order_id=work_order_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        serial_number=payload.serial_number,
        notes=payload.notes,
        warehouse_id=canonical_warehouse_id,
    )
    db.add(item)

    db.commit()
    db.refresh(item)

    return WorkOrderItemResponse(
        id=item.id,
        product_id=item.product_id,
        quantity=item.quantity,
        serial_number=item.serial_number,
        notes=item.notes,
        warehouse_id=item.warehouse_id,
        created_at=item.created_at,
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


@router.post("/{work_order_id}/recovery", response_model=WorkOrderRecoveryResponse)
def recover_work_order_equipment(
    work_order_id: int,
    payload: WorkOrderRecoveryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registrar equipos de la empresa recuperados del domicilio.

    Estados: funciona | no_funciona | revisar. Idempotente: activos ya retirados se
    omiten y seriales ya existentes se reutilizan (no duplica SerialItem).
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder no encontrada")

    ticket = db.query(Ticket).filter(Ticket.id == wo.ticket_id).first()
    connection_id = (
        (ticket.connection_id if ticket else None)
        or (ticket.destination_connection_id if ticket else None)
        or (ticket.origin_connection_id if ticket else None)
    )

    technician_warehouse_id = _get_work_order_warehouse_id(db, wo, current_user.id)
    if not technician_warehouse_id:
        raise HTTPException(
            status_code=422,
            detail="No se pudo determinar el depósito móvil de la cuadrilla para recibir los equipos",
        )

    STATE_TO_STATUS = {
        "funciona": SerialItemStatus.IN_VEHICLE,
        "no_funciona": SerialItemStatus.DEFECTIVE,
        "revisar": SerialItemStatus.DEFECTIVE,
    }

    recovered = 0
    for item in payload.items:
        state = (item.state or "").strip().lower()
        if state not in STATE_TO_STATUS:
            raise HTTPException(
                status_code=422,
                detail=f"Estado de recuperación inválido: {item.state}",
            )
        new_status = STATE_TO_STATUS[state]

        if item.connection_asset_id:
            # Equipo ya registrado como instalado en la conexión. Se acota a la
            # conexión efectiva de la OT para no retirar activos de otro domicilio.
            asset_query = db.query(ConnectionAsset).filter(
                ConnectionAsset.id == item.connection_asset_id
            )
            if connection_id:
                asset_query = asset_query.filter(
                    ConnectionAsset.connection_id == connection_id
                )
            asset = asset_query.first()
            if not asset:
                raise HTTPException(
                    status_code=422,
                    detail=f"Activo {item.connection_asset_id} no encontrado en esta conexión",
                )
            if asset.status == ConnectionAssetStatus.REMOVED.value:
                continue  # idempotente: ya fue retirado

            serial_item = (
                db.query(SerialItem).filter(SerialItem.id == asset.serial_item_id).first()
            )

            asset.status = ConnectionAssetStatus.REMOVED.value
            asset.removed_at = datetime.now(timezone.utc)
            asset.removed_by_wo_id = work_order_id
            asset.notes = (asset.notes + " | " if asset.notes else "") + f"Recuperado: {state}"

            if serial_item:
                origin_warehouse_id = serial_item.warehouse_id
                serial_item.status = new_status
                serial_item.warehouse_id = technician_warehouse_id
                serial_item.connection_id = None

                movement = StockMovement(
                    product_id=serial_item.product_id,
                    from_warehouse_id=origin_warehouse_id,
                    to_warehouse_id=technician_warehouse_id,
                    serial_item_id=serial_item.id,
                    movement_type=MovementType.RECOVERY,
                    reference=f"OT #{work_order_id}",
                    user_id=current_user.id,
                    notes=f"Recuperado del domicilio: {serial_item.serial_number} ({state})",
                )
                db.add(movement)
        else:
            # Equipo no registrado: alta best-effort como candidato a baja/stock.
            if not item.product_id or not item.serial_number:
                raise HTTPException(
                    status_code=422,
                    detail="Equipo no registrado requiere product_id y serial_number",
                )

            serial_item = (
                db.query(SerialItem)
                .filter(SerialItem.serial_number == item.serial_number)
                .first()
            )
            if serial_item:
                serial_item.status = new_status
                serial_item.warehouse_id = technician_warehouse_id
                serial_item.connection_id = None
            else:
                serial_item = SerialItem(
                    serial_number=item.serial_number,
                    product_id=item.product_id,
                    warehouse_id=technician_warehouse_id,
                    status=new_status,
                    is_generated_barcode=False,
                )
                db.add(serial_item)
                db.flush()

            movement = StockMovement(
                product_id=item.product_id,
                from_warehouse_id=None,
                to_warehouse_id=technician_warehouse_id,
                serial_item_id=serial_item.id,
                movement_type=MovementType.RECOVERY,
                reference=f"OT #{work_order_id}",
                user_id=current_user.id,
                notes=f"Equipo no registrado recuperado: {item.serial_number} ({state})",
            )
            db.add(movement)

        recovered += 1

    db.commit()
    return WorkOrderRecoveryResponse(recovered=recovered)


# ============================================================
# ENDPOINTS: Bitácora post-cierre (P2)
# ============================================================

ALLOWED_WO_UPDATE_TYPES = {
    "MATERIALS_ADDED",
    "MATERIALS_REMOVED",
    "MATERIALS_REPLACED",
    "MATERIALS_QTY_UPDATED",
    "INFO_CORRECTION",
    "CLOSE_CORRECTION",
    "NOTE",
}

# Ventana de gracia de la bitácora: el técnico corrige su propia OT durante el
# mismo día calendario local (America/Argentina/Buenos_Aires). Fuera de la ventana
# la corrección queda PROPOSED y requiere aprobación.
_WO_UPDATE_LOCAL_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


def _resolve_wo_connection_id(db: Session, wo: WorkOrder) -> Optional[int]:
    """Resuelve la conexión efectiva asociada al ticket de la OT."""
    ticket = db.query(Ticket).filter(Ticket.id == wo.ticket_id).first()
    if not ticket:
        return None
    return (
        ticket.connection_id
        or ticket.destination_connection_id
        or ticket.origin_connection_id
    )


def _apply_material_removed_effect(
    db: Session,
    wo: WorkOrder,
    user: User,
    material: dict,
) -> None:
    """Revoca el consumo de un item y lo elimina de la OT (MATERIALS_REMOVED)."""
    item_id = material.get("work_order_item_id")
    if not item_id:
        raise HTTPException(
            status_code=422,
            detail="MATERIALS_REMOVED requiere work_order_item_id en payload",
        )

    item = (
        db.query(WorkOrderItem)
        .filter(
            WorkOrderItem.id == item_id,
            WorkOrderItem.work_order_id == wo.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item de la OT no encontrado")

    try:
        reverse_material_item(db, item, user.id, reference_suffix=" (bitácora)")
    except CompletionError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))

    db.delete(item)


def _apply_material_qty_updated_effect(
    db: Session,
    wo: WorkOrder,
    user: User,
    material: dict,
) -> None:
    """Corrige la cantidad de un item BULK (MATERIALS_QTY_UPDATED)."""
    item_id = material.get("work_order_item_id")
    new_quantity = material.get("new_quantity")
    if not item_id or new_quantity is None:
        raise HTTPException(
            status_code=422,
            detail="MATERIALS_QTY_UPDATED requiere work_order_item_id y new_quantity en payload",
        )

    try:
        new_quantity_f = float(new_quantity)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail="new_quantity debe ser un número",
        )
    if new_quantity_f <= 0:
        raise HTTPException(status_code=422, detail="new_quantity debe ser mayor a 0")

    item = (
        db.query(WorkOrderItem)
        .filter(
            WorkOrderItem.id == item_id,
            WorkOrderItem.work_order_id == wo.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item de la OT no encontrado")

    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if product.type == "SERIALIZED":
        raise HTTPException(
            status_code=422,
            detail="No se puede corregir cantidad de un item serializado; usar MATERIALS_REPLACED",
        )

    connection_id = _resolve_wo_connection_id(db, wo)

    # 1) Revertir el consumo anterior (devuelve saldo/stock al estado pre-cierre).
    try:
        reverse_material_item(db, item, user.id, reference_suffix=" (bitácora)")
    except CompletionError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))

    # 2) Re-procesar con la cantidad corregida (limpia el snapshot para re-capturarlo).
    item.quantity = new_quantity_f
    item.previous_serial_status = None
    item.previous_warehouse_id = None
    item.previous_remaining_quantity = None
    try:
        _process_item(db, item, connection_id, user.id, wo.id, item.warehouse_id)
    except CompletionError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))


def _apply_material_replaced_effect(
    db: Session,
    wo: WorkOrder,
    user: User,
    material: dict,
) -> None:
    """Quita un item erróneo y agrega el correcto (MATERIALS_REPLACED)."""
    remove_item_id = material.get("remove_work_order_item_id")
    if not remove_item_id:
        raise HTTPException(
            status_code=422,
            detail="MATERIALS_REPLACED requiere remove_work_order_item_id en payload",
        )

    # 1) Quitar el item erróneo (reversa + borrado).
    _apply_material_removed_effect(
        db, wo, user, {"work_order_item_id": remove_item_id}
    )

    # 2) Agregar el material correcto (mismo contrato que MATERIALS_ADDED).
    _apply_material_added_effect(db, wo, user, material)


def _apply_work_order_update_effect(
    db: Session,
    wo: WorkOrder,
    user: User,
    update_type: str,
    material: dict,
) -> None:
    """Despacha el efecto de inventario según el tipo de actualización."""
    if update_type == "MATERIALS_ADDED":
        _apply_material_added_effect(db, wo, user, material)
    elif update_type == "MATERIALS_REMOVED":
        _apply_material_removed_effect(db, wo, user, material)
    elif update_type == "MATERIALS_QTY_UPDATED":
        _apply_material_qty_updated_effect(db, wo, user, material)
    elif update_type == "MATERIALS_REPLACED":
        _apply_material_replaced_effect(db, wo, user, material)


def _validate_material_added(
    db: Session,
    wo: WorkOrder,
    user: User,
    material: dict,
) -> None:
    """Dry-run: valida que el material a agregar sea factible sin mutar inventario."""
    product_id = material.get("product_id")
    quantity = material.get("quantity")
    if not product_id or quantity is None:
        raise HTTPException(
            status_code=422,
            detail="MATERIALS_ADDED requiere product_id y quantity en payload",
        )
    try:
        quantity_f = float(quantity)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="quantity debe ser un número")
    if quantity_f <= 0:
        raise HTTPException(status_code=422, detail="quantity debe ser mayor a 0")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    connection_id = _resolve_wo_connection_id(db, wo)
    serial_number = material.get("serial_number")

    if product.type == "SERIALIZED":
        if not connection_id:
            raise HTTPException(
                status_code=422,
                detail="No se puede agregar un serial sin conexión asociada al ticket",
            )
        if not serial_number:
            raise HTTPException(status_code=422, detail="El producto serializado requiere número de serie")
        si = db.query(SerialItem).filter(SerialItem.serial_number == serial_number).first()
        if not si:
            raise HTTPException(status_code=422, detail=f"Serial {serial_number} no encontrado en inventario")
        if si.status == SerialItemStatus.INSTALLED:
            raise HTTPException(
                status_code=422,
                detail=f"Serial {serial_number} ya está instalado en otra conexión",
            )
        return

    if product.type == "BULK":
        # Unidad compuesta trazable (ej: bobina de drop por metros)
        if product.is_composite and serial_number:
            si = db.query(SerialItem).filter(SerialItem.serial_number == serial_number).first()
            if not si:
                raise HTTPException(status_code=422, detail=f"Serial {serial_number} no encontrado en inventario")
            remaining = si.remaining_quantity
            if remaining is None:
                remaining = product.unit_size
            if remaining is None or remaining + 1e-9 < quantity_f:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Stock insuficiente de {product.name}: "
                        f"disponible {remaining or 0}, requerido {quantity_f}"
                    ),
                )
            return

        # BULK agregado (conectores, cable, etc.)
        warehouse_id = _get_work_order_warehouse_id(db, wo, user.id)
        if not warehouse_id:
            raise HTTPException(
                status_code=422,
                detail="No se pudo determinar el depósito móvil para validar stock",
            )
        qty_to_check = quantity_f
        if product.is_composite:
            if not product.unit_size or product.unit_size <= 0:
                raise HTTPException(
                    status_code=422,
                    detail=f"El producto compuesto {product.name} no tiene unit_size válido",
                )
            qty_to_check = round(quantity_f / product.unit_size, 6)
        stock_entry = (
            db.query(StockBulk)
            .filter(
                StockBulk.product_id == product_id,
                StockBulk.warehouse_id == warehouse_id,
            )
            .first()
        )
        available = stock_entry.quantity if stock_entry else 0
        if available + 1e-9 < qty_to_check:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Stock insuficiente de {product.name}: "
                    f"disponible {available}, requerido {qty_to_check}"
                ),
            )
        return


def _validate_update_effect(
    db: Session,
    wo: WorkOrder,
    user: User,
    update_type: str,
    material: dict,
) -> None:
    """Valida la factibilidad de una actualización de materiales sin mutar (dry-run)."""
    if update_type == "MATERIALS_ADDED":
        _validate_material_added(db, wo, user, material)
        return

    if update_type == "MATERIALS_REMOVED":
        item_id = material.get("work_order_item_id")
        if not item_id:
            raise HTTPException(
                status_code=422,
                detail="MATERIALS_REMOVED requiere work_order_item_id en payload",
            )
        item = (
            db.query(WorkOrderItem)
            .filter(WorkOrderItem.id == item_id, WorkOrderItem.work_order_id == wo.id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Item de la OT no encontrado")
        return

    if update_type == "MATERIALS_QTY_UPDATED":
        item_id = material.get("work_order_item_id")
        new_quantity = material.get("new_quantity")
        if not item_id or new_quantity is None:
            raise HTTPException(
                status_code=422,
                detail="MATERIALS_QTY_UPDATED requiere work_order_item_id y new_quantity en payload",
            )
        try:
            new_quantity_f = float(new_quantity)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="new_quantity debe ser un número")
        if new_quantity_f <= 0:
            raise HTTPException(status_code=422, detail="new_quantity debe ser mayor a 0")
        item = (
            db.query(WorkOrderItem)
            .filter(WorkOrderItem.id == item_id, WorkOrderItem.work_order_id == wo.id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Item de la OT no encontrado")
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product and product.type == "SERIALIZED":
            raise HTTPException(
                status_code=422,
                detail="No se puede corregir cantidad de un item serializado; usar MATERIALS_REPLACED",
            )
        return

    if update_type == "MATERIALS_REPLACED":
        remove_item_id = material.get("remove_work_order_item_id")
        if not remove_item_id:
            raise HTTPException(
                status_code=422,
                detail="MATERIALS_REPLACED requiere remove_work_order_item_id en payload",
            )
        item = (
            db.query(WorkOrderItem)
            .filter(WorkOrderItem.id == remove_item_id, WorkOrderItem.work_order_id == wo.id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Item a reemplazar no encontrado en la OT")
        _validate_material_added(db, wo, user, material)
        return


def _apply_material_added_effect(
    db: Session,
    wo: WorkOrder,
    user: User,
    material: dict,
) -> WorkOrderItem:
    """Crea y procesa un WorkOrderItem para MATERIALS_ADDED (post-cierre)."""
    product_id = material.get("product_id")
    quantity = material.get("quantity")
    if not product_id or not quantity:
        raise HTTPException(
            status_code=422,
            detail="MATERIALS_ADDED requiere product_id y quantity en payload",
        )

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    ticket = db.query(Ticket).filter(Ticket.id == wo.ticket_id).first()
    connection_id = (
        (ticket.connection_id if ticket else None)
        or (ticket.destination_connection_id if ticket else None)
        or (ticket.origin_connection_id if ticket else None)
    )
    if product.type == "SERIALIZED" and not connection_id:
        raise HTTPException(
            status_code=422,
            detail="No se puede agregar un serial sin conexión asociada al ticket",
        )

    serial_number = material.get("serial_number")

    # Unificación: si es BULK compuesto trazable (ej: bobina de drop) y la OT ya
    # tiene un consumo con el mismo serial, se suma a esa línea en lugar de duplicarla
    # (equivalente a corregir la cantidad). Evita líneas duplicadas del mismo serial.
    if product.type == "BULK" and product.is_composite and serial_number:
        existing = (
            db.query(WorkOrderItem)
            .filter(
                WorkOrderItem.work_order_id == wo.id,
                WorkOrderItem.serial_number == serial_number,
            )
            .first()
        )
        if existing:
            try:
                reverse_material_item(db, existing, user.id, reference_suffix=" (bitácora)")
            except CompletionError as exc:
                db.rollback()
                raise HTTPException(status_code=422, detail=str(exc))

            existing.quantity = round(existing.quantity + float(quantity), 6)
            existing.previous_serial_status = None
            existing.previous_warehouse_id = None
            existing.previous_remaining_quantity = None
            try:
                _process_item(db, existing, connection_id, user.id, wo.id, existing.warehouse_id)
            except CompletionError as exc:
                db.rollback()
                raise HTTPException(status_code=422, detail=str(exc))
            return existing

    canonical_warehouse_id = _get_work_order_warehouse_id(db, wo, user.id)
    item = WorkOrderItem(
        work_order_id=wo.id,
        product_id=int(product_id),
        quantity=float(quantity),
        serial_number=material.get("serial_number"),
        notes=material.get("notes"),
        warehouse_id=canonical_warehouse_id,
    )
    db.add(item)
    db.flush()

    try:
        _process_item(db, item, connection_id, user.id, wo.id, canonical_warehouse_id)
    except CompletionError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))

    return item


def _build_update_contexts(db: Session, updates: list) -> dict:
    """
    Resuelve el contexto mínimo para decidir una aprobación: técnico que la
    solicitó, cuadrilla, móvil, y cliente/conexión del ticket de la OT.
    Devuelve {update_id: {campo: valor}} con cargas bulk (sin N+1).
    """
    from src.models.fleet import Vehicle
    from src.models.beholder import Connection, Cliente

    if not updates:
        return {}

    wo_ids = {u.work_order_id for u in updates}
    wos = {
        wo.id: wo
        for wo in db.query(WorkOrder).filter(WorkOrder.id.in_(wo_ids)).all()
    }

    user_ids = {u.author_id for u in updates if u.author_id}
    user_ids |= {wo.technician_id for wo in wos.values() if wo.technician_id}
    users = (
        {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids
        else {}
    )

    team_ids = {wo.team_id for wo in wos.values() if wo.team_id}
    teams = (
        {t.id: t for t in db.query(Team).filter(Team.id.in_(team_ids)).all()}
        if team_ids
        else {}
    )

    vehicle_ids = {t.vehicle_id for t in teams.values() if t.vehicle_id}
    vehicles = (
        {v.id: v for v in db.query(Vehicle).filter(Vehicle.id.in_(vehicle_ids)).all()}
        if vehicle_ids
        else {}
    )

    ticket_ids = {wo.ticket_id for wo in wos.values()}
    tickets = (
        {t.id: t for t in db.query(Ticket).filter(Ticket.id.in_(ticket_ids)).all()}
        if ticket_ids
        else {}
    )

    conn_ids = set()
    for t in tickets.values():
        for cid in (t.connection_id, t.destination_connection_id, t.origin_connection_id):
            if cid:
                conn_ids.add(cid)
    connections = (
        {
            c.connection_id: c
            for c in db.query(Connection)
            .filter(Connection.connection_id.in_(conn_ids))
            .all()
        }
        if conn_ids
        else {}
    )

    customer_ids = {c.customer_id for c in connections.values() if c.customer_id}
    clientes = (
        {cl.id: cl for cl in db.query(Cliente).filter(Cliente.id.in_(customer_ids)).all()}
        if customer_ids
        else {}
    )

    result: dict = {}
    for u in updates:
        wo = wos.get(u.work_order_id)
        ctx: dict = {}

        author = users.get(u.author_id) if u.author_id else None
        if author and getattr(author, "full_name", None):
            ctx["technician_name"] = author.full_name

        team = teams.get(wo.team_id) if wo and wo.team_id else None
        if team:
            ctx["team_name"] = team.name
            vehicle = vehicles.get(team.vehicle_id) if team.vehicle_id else None
            if vehicle:
                ctx["vehicle_label"] = vehicle.full_name

        ticket = tickets.get(wo.ticket_id) if wo else None
        conn = None
        if ticket:
            conn = (
                connections.get(ticket.connection_id)
                or connections.get(ticket.destination_connection_id)
                or connections.get(ticket.origin_connection_id)
            )
        if conn:
            ctx["connection_label"] = conn.pppoe_username or f"Conexión #{conn.connection_id}"
            cliente = clientes.get(conn.customer_id) if conn.customer_id else None
            if cliente and getattr(cliente, "name", None):
                ctx["client_name"] = cliente.name

        result[u.id] = ctx

    return result


@router.get("/updates/pending", response_model=WorkOrderUpdatePendingListResponse)
def list_pending_work_order_updates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listar entradas PROPOSED pendientes de aprobación (para coordinadores)."""
    updates = (
        db.query(WorkOrderUpdateModel)
        .filter(WorkOrderUpdateModel.status == "PROPOSED")
        .order_by(WorkOrderUpdateModel.created_at.asc())
        .all()
    )
    contexts = _build_update_contexts(db, updates)
    return WorkOrderUpdatePendingListResponse(
        updates=[
            WorkOrderUpdatePendingResponse(
                id=u.id,
                work_order_id=u.work_order_id,
                author_id=u.author_id,
                update_type=u.update_type,
                status=u.status,
                motive=u.motive,
                payload=u.payload,
                created_at=u.created_at,
                **contexts.get(u.id, {}),
            )
            for u in updates
        ]
    )


@router.get("/{work_order_id}/updates", response_model=WorkOrderUpdatesListResponse)
def list_work_order_updates(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listar la bitácora post-cierre de una OT."""
    updates = (
        db.query(WorkOrderUpdateModel)
        .filter(WorkOrderUpdateModel.work_order_id == work_order_id)
        .order_by(WorkOrderUpdateModel.created_at.desc())
        .all()
    )
    return WorkOrderUpdatesListResponse(
        updates=[WorkOrderUpdateResponse.model_validate(u) for u in updates]
    )


@router.post(
    "/{work_order_id}/updates",
    response_model=WorkOrderUpdateResponse,
    status_code=201,
)
def create_work_order_update(
    work_order_id: int,
    payload: WorkOrderUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registrar una actualización post-cierre en la bitácora (append-only)."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder no encontrada")

    if wo.status not in (WorkOrderStatus.completed, WorkOrderStatus.failed):
        raise HTTPException(
            status_code=409,
            detail="La bitácora post-cierre solo se habilita para OTs completadas o no realizadas",
        )

    if payload.update_type not in ALLOWED_WO_UPDATE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"update_type inválido: {payload.update_type}",
        )

    # Validación dry-run de materiales: da feedback inmediato al técnico (aunque
    # la entrada quede PROPOSED), evitando correcciones inviables que fallarían
    # recién al aprobar.
    if payload.update_type in (
        "MATERIALS_ADDED",
        "MATERIALS_REMOVED",
        "MATERIALS_QTY_UPDATED",
        "MATERIALS_REPLACED",
    ):
        _validate_update_effect(db, wo, current_user, payload.update_type, payload.payload or {})

    # Determinación de status según responsabilidad (ventana de gracia = mismo día local).
    role_name = current_user.role.name if current_user.role else None
    is_approver = (
        role_name in ("admin", "coordinator", "tecnico_encargado")
        or current_user.is_superuser
    )
    is_own_technician = wo.technician_id is not None and wo.technician_id == current_user.id

    window_ok = False
    if wo.completed_at:
        completed = wo.completed_at
        if completed.tzinfo is None:
            completed = completed.replace(tzinfo=timezone.utc)
        local_completed = completed.astimezone(_WO_UPDATE_LOCAL_TZ)
        local_now = datetime.now(timezone.utc).astimezone(_WO_UPDATE_LOCAL_TZ)
        window_ok = local_completed.date() == local_now.date()

    status_value = "APPLIED" if (is_approver or (is_own_technician and window_ok)) else "PROPOSED"

    entry = WorkOrderUpdateModel(
        work_order_id=work_order_id,
        author_id=current_user.id,
        update_type=payload.update_type,
        status=status_value,
        motive=payload.motive,
        payload=payload.payload,
    )
    db.add(entry)
    db.flush()

    # Efecto de inventario (solo si se aplica de inmediato).
    if status_value == "APPLIED":
        try:
            _apply_work_order_update_effect(
                db, wo, current_user, payload.update_type, payload.payload or {}
            )
        except HTTPException:
            db.rollback()
            raise
        except CompletionError as exc:
            db.rollback()
            raise HTTPException(status_code=422, detail=str(exc))

    timeline_event = TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"📝 Bitácora OT #{work_order_id}: {payload.update_type} — {payload.motive[:200]}",
        meta_data={
            "update_type": payload.update_type,
            "status": status_value,
            "update_id": entry.id,
        },
    )
    db.add(timeline_event)

    db.commit()
    db.refresh(entry)

    try:
        log_create(
            db=db,
            user_id=current_user.id,
            entity_name="work_order_updates",
            entity_id=entry.id,
            new_values={
                "work_order_id": work_order_id,
                "update_type": payload.update_type,
                "status": status_value,
                "motive": payload.motive,
            },
        )
    except Exception as audit_error:
        logger.error(f"Error al auditar bitácora OT #{work_order_id}: {audit_error}")

    return WorkOrderUpdateResponse.model_validate(entry)


@router.patch("/updates/{update_id}/status", response_model=WorkOrderUpdateResponse)
def set_work_order_update_status(
    update_id: int,
    payload: WorkOrderUpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aprobar o rechazar una entrada PROPOSED de la bitácora."""
    entry = db.query(WorkOrderUpdateModel).filter(WorkOrderUpdateModel.id == update_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada de bitácora no encontrada")

    role_name = current_user.role.name if current_user.role else None
    is_approver = (
        role_name in ("admin", "coordinator", "tecnico_encargado")
        or current_user.is_superuser
    )
    if not is_approver:
        raise HTTPException(status_code=403, detail="Solo coordinadores/admin pueden aprobar")

    if payload.status not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=422, detail="status debe ser APPROVED o REJECTED")

    previous_status = entry.status
    was_proposed = previous_status == "PROPOSED"
    entry.status = payload.status

    # Al aprobar una entrada PROPOSED, se aplica el efecto de inventario.
    if payload.status == "APPROVED" and was_proposed:
        wo = db.get(WorkOrder, entry.work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="WorkOrder no encontrada")
        try:
            _apply_work_order_update_effect(
                db, wo, current_user, entry.update_type, entry.payload or {}
            )
        except HTTPException:
            db.rollback()
            raise
        except CompletionError as exc:
            db.rollback()
            raise HTTPException(status_code=422, detail=str(exc))

    db.commit()
    db.refresh(entry)

    try:
        log_update(
            db=db,
            user_id=current_user.id,
            entity_name="work_order_updates",
            entity_id=entry.id,
            old_values={"status": previous_status},
            new_values={"status": payload.status},
        )
    except Exception as audit_error:
        logger.error(f"Error al auditar aprobación de bitácora {entry.id}: {audit_error}")

    return WorkOrderUpdateResponse.model_validate(entry)


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


@router.post("/{work_order_id}/cancel", response_model=WorkOrderDetailResponse)
def cancel_work_order(
    work_order_id: int,
    payload: WorkOrderCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancelar (anular) una OT que aún no fue coordinada.

    Carrier-class: NO se borra la OT. Pasa a estado `cancelled` con timestamp y
    queda en historial para auditoría. Solo operadores y solo sobre OTs en
    `pending_planning` (período de gracia para corregir errores o regenerar).

    Errores:
    - 404: OT no existe
    - 403: sin permisos de operador
    - 409: ya cancelada o finalizada (inmutable)
    - 422: la OT ya fue coordinada (no se puede cancelar)
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de Trabajo no encontrada",
        )

    role_name = current_user.role.name if current_user.role else None
    is_operator = (
        role_name in ("admin", "coordinator", "tecnico_encargado")
        or current_user.is_superuser
    )
    if not is_operator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo operadores (coordinador/admin) pueden cancelar una OT",
        )

    if wo.status == WorkOrderStatus.cancelled:
        raise HTTPException(status_code=409, detail="La OT ya está cancelada")

    if wo.status in (WorkOrderStatus.completed, WorkOrderStatus.failed):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La OT ya está finalizada y no se puede cancelar",
        )

    if wo.status != WorkOrderStatus.pending_planning:
        raise HTTPException(
            status_code=422,
            detail="Solo se pueden cancelar OTs que aún no fueron coordinadas (pendiente de planificación)",
        )

    old_status = wo.status
    wo.status = WorkOrderStatus.cancelled
    wo.cancelled_at = datetime.now(timezone.utc)

    timeline_event = TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"🚫 OT #{wo.id} cancelada por operador: {payload.motive[:200]}",
        meta_data={
            "work_order_id": wo.id,
            "action": "cancel",
            "old_status": old_status.value,
            "new_status": WorkOrderStatus.cancelled.value,
            "status": WorkOrderStatus.cancelled.value,
            "current_status": WorkOrderStatus.cancelled.value,
            "work_order_status": WorkOrderStatus.cancelled.value,
            "motive": payload.motive,
            "cancelled_by": current_user.full_name or current_user.email,
            "cancelled_by_role": role_name,
        },
    )
    db.add(timeline_event)

    db.commit()
    db.refresh(wo)

    try:
        log_update(
            db=db,
            user_id=current_user.id,
            entity_name="work_orders",
            entity_id=wo.id,
            old_values={"status": old_status.value},
            new_values={
                "status": WorkOrderStatus.cancelled.value,
                "cancelled_at": wo.cancelled_at.isoformat() if wo.cancelled_at else None,
                "motive": payload.motive,
            },
        )
    except Exception as audit_error:
        logger.error(f"Error al auditar cancelación de OT {wo.id}: {audit_error}")

    return get_work_order_detail(work_order_id, db, current_user)


@router.post("/{work_order_id}/cancel-start", response_model=WorkOrderDetailResponse)
def cancel_work_order_start(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancelar un inicio accidental de OT por parte del técnico.

    Revierte el estado `in_progress` al estado previo correspondiente
    (`scheduled` / `assigned` / `pending_planning`) y limpia `started_at`.

    **Reglas de Negocio:**
    - Solo aplica a OTs en curso (`in_progress`) con `started_at` definido.
    - OTs completadas/fallidas son inmutables.
    - El tiempo registrado desde el inicio se descarta (se pierde).
    - Los materiales ya cargados NO se modifican.

    **Errores:**
    - 404: OT no existe
    - 423: OT ya finalizada (inmutable)
    - 400: La OT no está en curso (no hay un inicio que cancelar)
    """
    wo = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.team),
            joinedload(WorkOrder.ticket),
        )
        .filter(WorkOrder.id == work_order_id)
        .first()
    )

    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de Trabajo no encontrada",
        )

    # OTs finalizadas son inmutables
    if wo.status in [WorkOrderStatus.completed, WorkOrderStatus.failed]:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="La OT ya está finalizada y no se puede cancelar.",
        )

    # Solo se puede cancelar un inicio real
    if wo.status != WorkOrderStatus.in_progress or not wo.started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La OT no está en curso; no hay un inicio que cancelar.",
        )

    old_status = wo.status
    old_started_at = wo.started_at

    # Revertir al estado previo lógico según el tipo de asignación
    if wo.team_id is not None:
        target_status = WorkOrderStatus.scheduled
    elif wo.technician_id is not None:
        target_status = WorkOrderStatus.assigned
    else:
        target_status = WorkOrderStatus.pending_planning

    wo.status = target_status
    wo.started_at = None

    # Evento de timeline con trazabilidad de la corrección
    db.add(TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=(
            f"OT #{wo.id}: inicio cancelado por el técnico. "
            f"El tiempo registrado fue descartado."
        ),
        meta_data={
            "work_order_id": wo.id,
            "action": "cancel_start",
            "old_status": old_status.value,
            "new_status": target_status.value,
            "discarded_started_at": old_started_at.isoformat() if old_started_at else None,
            "cancelled_by": current_user.full_name or current_user.email,
        },
    ))

    # 🔒 AUDIT LOG
    try:
        log_update(
            db=db,
            user_id=current_user.id,
            entity_name="work_orders",
            entity_id=wo.id,
            old_values={
                "status": old_status.value,
                "started_at": old_started_at.isoformat() if old_started_at else None,
            },
            new_values={
                "status": target_status.value,
                "started_at": None,
            },
        )
    except Exception as audit_error:
        logging.getLogger("uvicorn.error").error(
            f"❌ [AUDIT] Error al registrar cancelación de inicio de OT {wo.id}: {audit_error}"
        )

    db.commit()
    db.refresh(wo)

    return get_work_order_detail(work_order_id, db, current_user)


def _bulk_fetch_connections(db: Session, connection_ids: list[int]) -> dict:
    """Prefetch de datos de conexión en UNA sola query (evita N+1 por OT)."""
    ids = list(dict.fromkeys([int(i) for i in connection_ids if i])) if connection_ids else []
    if not ids:
        return {}
    rows = db.execute(
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
                COALESCE(
                    ct.number,
                    cl.raw_data->>'phone',
                    cl.raw_data->>'mobile',
                    cl.raw_data->>'telefono'
                ) as phone,
                cy.name as city_name,
                nb.name as neighborhood_name,
                c.address_parts
            FROM connections c
            LEFT JOIN clientes cl ON c.customer_id = cl.id
            LEFT JOIN LATERAL (
                SELECT ct_inner.number
                FROM clientes_telefonos ct_inner
                WHERE ct_inner.customer_id = cl.id
                  AND ct_inner.number IS NOT NULL
                  AND btrim(ct_inner.number) <> ''
                ORDER BY ct_inner.id ASC
                LIMIT 1
            ) ct ON true
            LEFT JOIN nodes n ON c.node_id = n.node_id
            LEFT JOIN plans p ON c.plan_id = p.plan_id
            LEFT JOIN cities cy ON c.city_id = cy.id
            LEFT JOIN neighborhoods nb ON c.neighborhood_id = nb.id
            WHERE c.connection_id = ANY(:conn_ids)
            """
        ),
        {"conn_ids": ids},
    ).all()
    return {row[0]: row for row in rows}


def _wo_to_list_response(wo: WorkOrder, db: Session, conn_map: Optional[dict] = None):
    """Construye la respuesta resumida para listado, enriquecida con datos de conexión.
    
    Retorna un diccionario simple para evitar problemas de serialización Pydantic
    con forward references en nested models.
    """
    ticket_title = wo.ticket.subject if wo.ticket else "Sin ticket"
    client_name = None
    address = getattr(wo.ticket, "availability_note", None)
    address_parts = None

    # Fuente de verdad del cliente: datos de conexión/contacto del ticket.
    # Nunca usar el creador del ticket como nombre de cliente.
    if wo.ticket and isinstance(wo.ticket.connection_details, dict):
        contact = wo.ticket.connection_details
        client_name = contact.get("client_name") or contact.get("name")
        address = contact.get("address") or contact.get("direccion") or address

    # Construir ticket_response si existe - como diccionario para evitar forward references
    ticket_dict = None
    if wo.ticket:
        ticket_dict = {
            "id": wo.ticket.id,
            "subject": wo.ticket.subject,
            "status": wo.ticket.status,
            "priority": wo.ticket.priority,
            "ticket_type": wo.ticket.ticket_type,
            "administrative_subtype": wo.ticket.administrative_subtype,
            "connection_id": wo.ticket.connection_id,
            "origin_connection_id": wo.ticket.origin_connection_id,
            "destination_connection_id": wo.ticket.destination_connection_id,
            "installation_tech": wo.ticket.installation_tech,
            "availability_note": wo.ticket.availability_note,
            "contact_info": wo.ticket.connection_details,  # JSONB del modelo → schema contact_info
            "created_at": wo.ticket.created_at.isoformat() if wo.ticket.created_at else None,
            "updated_at": wo.ticket.updated_at.isoformat() if wo.ticket.updated_at else None,
            "creator_name": wo.ticket.creator.full_name if wo.ticket.creator else None,
            "assigned_to_name": wo.ticket.assigned_to.full_name if wo.ticket.assigned_to else None,
            "client_name": client_name,
            "category_name": wo.ticket.category.name if wo.ticket.category else None,
            "reason_name": wo.ticket.reason.name if wo.ticket.reason else None,
            "tags": [],  # Por performance, no cargamos tags en listado
        }

    # Enriquecer con datos de conexión si existe (fallback cuando faltan datos clave).
    # Para instalaciones/traslados la conexión vive en destination/origin_connection_id,
    # no en connection_id (que puede ser NULL), así que usamos el id efectivo.
    effective_connection_id = (
        wo.ticket.connection_id
        or wo.ticket.destination_connection_id
        or wo.ticket.origin_connection_id
    ) if wo.ticket else None

    if wo.ticket and effective_connection_id:
        try:
            # Preferir mapa prefetcheado (evita N+1 por OT); si no hay, query puntual.
            conn_row = conn_map.get(effective_connection_id) if conn_map is not None else None
            if conn_row is None:
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
                            COALESCE(
                                ct.number,
                                cl.raw_data->>'phone',
                                cl.raw_data->>'mobile',
                                cl.raw_data->>'telefono'
                            ) as phone,
                            cy.name as city_name,
                            nb.name as neighborhood_name,
                            c.address_parts
                        FROM connections c
                        LEFT JOIN clientes cl ON c.customer_id = cl.id
                        LEFT JOIN LATERAL (
                            SELECT ct_inner.number
                            FROM clientes_telefonos ct_inner
                            WHERE ct_inner.customer_id = cl.id
                              AND ct_inner.number IS NOT NULL
                              AND btrim(ct_inner.number) <> ''
                            ORDER BY ct_inner.id ASC
                            LIMIT 1
                        ) ct ON true
                        LEFT JOIN nodes n ON c.node_id = n.node_id
                        LEFT JOIN plans p ON c.plan_id = p.plan_id
                        LEFT JOIN cities cy ON c.city_id = cy.id
                        LEFT JOIN neighborhoods nb ON c.neighborhood_id = nb.id
                        WHERE c.connection_id = :conn_id
                        LIMIT 1
                        """
                    ),
                    {"conn_id": effective_connection_id},
                ).first()

            if conn_row:
                # Actualizar con datos reales de conexión
                address = conn_row[2] or address  # conexión dirección
                client_name = conn_row[3] or client_name  # cliente real
                # Enriquecer contact_info con ciudad y barrio
                if ticket_dict and not ticket_dict.get('contact_info'):
                    ticket_dict['contact_info'] = {}
                if ticket_dict and conn_row[9]:  # phone
                    ticket_dict['contact_info']['phone'] = conn_row[9]
                if ticket_dict and conn_row[10]:  # city_name
                    ticket_dict['contact_info']['city'] = conn_row[10]
                if ticket_dict and conn_row[11]:  # neighborhood_name
                    ticket_dict['contact_info']['neighborhood'] = conn_row[11]
                if conn_row[12]:  # address_parts (JSONB)
                    address_parts = conn_row[12]
                    if ticket_dict:
                        ticket_dict['contact_info']['address_parts'] = conn_row[12]
        except Exception as e:
            # Si falla la consulta, usar datos fallback del ticket
            print(f"⚠️  Error enriqueciendo conexión {effective_connection_id}: {e}")
            pass

    return {
        "id": wo.id,
        "ticket_id": wo.ticket_id,
        "ticket_title": ticket_title,
        "ticket": ticket_dict,  # Diccionario simple
        "ot_type": wo.ot_type.value if wo.ot_type else "unknown",
        "status": wo.status.value if wo.status else WorkOrderStatus.pending_planning.value,
        "priority": wo.priority.value if wo.priority else "medium",
        "client_name": client_name or "Sin cliente",
        "address": address or "-",
        "address_parts": address_parts,
        "technician_name": wo.technician.full_name if wo.technician else None,
        # CAMPOS DE COORDINACIÓN (AÑADIDOS PARA GRID DE COORDINACIÓN)
        "team_id": wo.team_id,
        "team_name": wo.team.name if wo.team else None,
        "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
        "estimated_duration": wo.estimated_duration,
        # CAMPOS DE UBICACIÓN
        "latitude": float(wo.latitude) if wo.latitude is not None else None,
        "longitude": float(wo.longitude) if wo.longitude is not None else None,
        # CAMPOS EXISTENTES
        "scheduled_at": wo.scheduled_at.isoformat() if wo.scheduled_at else None,
        "started_at": wo.started_at.isoformat() if wo.started_at else None,
        "completed_at": wo.completed_at.isoformat() if wo.completed_at else None,
        "created_at": wo.created_at.isoformat() if wo.created_at else None,
    }


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


@router.post("/{work_order_id}/mark-incomplete", response_model=dict)
def mark_work_order_incomplete(
    work_order_id: int,
    reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cuando un trabajo NO fue completado (ej: técnico llegó y no pudo hacerse),
    retorna las opciones disponibles para el coordinador:
    
    1. **reschedule**: Programar para otra fecha
    2. **reopen_backlog**: Devolver al backlog
    3. **create_new_from_ticket**: Crear nueva OT desde ticket
    
    **Request:**
    ```json
    {
        "reason": "Cliente no estaba disponible"  // Obligatorio para auditoría
    }
    ```
    
    **Response:**
    ```json
    {
        "work_order_id": 123,
        "status": "pending_action",
        "reason": "Cliente no estaba disponible",
        "options": {
            "reschedule": {...},
            "reopen_backlog": {...},
            "create_new_from_ticket": {...}
        }
    }
    ```
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    
    # Registrar en timeline
    timeline_event = TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"OT #{wo.id} marcada como NO realizada",
        meta_data={
            "work_order_id": wo.id,
            "status": wo.status.value,
            "reason": reason,
            "marked_incomplete_by": current_user.full_name or current_user.email,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    db.add(timeline_event)
    db.commit()
    
    # Obtener opciones disponibles
    options = get_coordination_options_for_incomplete_work_order(wo)
    
    return {
        "work_order_id": wo.id,
        "status": wo.status.value,
        "ticket_id": wo.ticket_id,
        "reason": reason,
        "options": options,
        "message": "Elige una opción para continuar con esta OT",
    }


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
        
        # Prefetch de contadores pending_closure por equipo (evita N+1 por team).
        pending_closure_map = dict(
            db.query(WorkOrder.team_id, func.count(WorkOrder.id))
            .filter(
                WorkOrder.status == WorkOrderStatus.pending_closure,
                WorkOrder.team_id.isnot(None),
            )
            .group_by(WorkOrder.team_id)
            .all()
        )

        teams_data = []
        for team in teams:
            pending_closure_count = pending_closure_map.get(team.id, 0)

            teams_data.append({
                "id": team.id,
                "name": team.name,
                "pending_closure_count": pending_closure_count,  # ← PRISIÓN DEL TÉCNICO
                "members": [
                    {
                        "id": m.user.id,
                        "name": m.user.full_name or m.user.email,
                        "role": m.role.value if hasattr(m.role, 'value') else str(m.role),
                    }
                    for m in team.members
                ]
            })
        
        # Allocations históricas del rango.
        # La grilla funciona como "Máquina del Tiempo": si la OT estuvo asignada a un equipo
        # en esa fecha, debe viajar al frontend sin filtrar estados finales.
        allocations = db.query(WorkOrder)\
            .filter(
                WorkOrder.team_id.isnot(None),
                WorkOrder.scheduled_start.isnot(None),
                WorkOrder.scheduled_start >= start,
                WorkOrder.scheduled_start <= end,
            )\
            .options(
                selectinload(WorkOrder.ticket).selectinload(Ticket.creator),
                selectinload(WorkOrder.team),
                selectinload(WorkOrder.technician),
            ).all()
        
        # (allocations_data se computa abajo, junto con backlog, con conn_map prefetcheado)
        
        # Backlog (pending_planning o coordinated sin team)
        backlog = db.query(WorkOrder)\
            .filter(
                WorkOrder.team_id.is_(None),
                WorkOrder.status.in_([WorkOrderStatus.pending_planning, WorkOrderStatus.coordinated])
            )\
            .options(
                selectinload(WorkOrder.ticket).selectinload(Ticket.creator),
                selectinload(WorkOrder.technician),
            ).all()
        
        # Prefetch de datos de conexión para allocations + backlog (evita N+1 por OT).
        conn_ids = []
        for wo in list(allocations) + list(backlog):
            if wo.ticket:
                eid = (
                    wo.ticket.connection_id
                    or wo.ticket.destination_connection_id
                    or wo.ticket.origin_connection_id
                )
                if eid:
                    conn_ids.append(eid)
        conn_map = _bulk_fetch_connections(db, conn_ids)

        allocations_data = [_wo_to_list_response(wo, db, conn_map) for wo in allocations]
        backlog_data = [_wo_to_list_response(wo, db, conn_map) for wo in backlog]
        
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
        logger.exception("Error al obtener grid de coordinacion")
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
    
    **Validaciones (NASA-grade):**
    - No permitir asignar a fecha pasada (< ahora - 5min)
    - OTs completadas/fallidas son inmutables
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id)\
        .options(joinedload(WorkOrder.ticket)).first()
    
    if not wo:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    
    if not payload.team_id or not payload.scheduled_start:
        raise HTTPException(status_code=400, detail="Requiere team_id y scheduled_start")
    
    # ===== VALIDACIÓN 1: BLOQUEAR SI OT ESTÁ COMPLETADA =====
    validate_coordination_not_locked(wo, db, current_user, operation="assign")
    
    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail=f"Team {payload.team_id} no existe")
    
    # ===== VALIDACIÓN 2: BLOQUEAR ASIGNACIÓN A FECHA PASADA =====
    from datetime import timezone
    grace_period = timedelta(minutes=5)
    now = datetime.now(timezone.utc)
    scheduled_start_tz = payload.scheduled_start
    if scheduled_start_tz.tzinfo is None:
        scheduled_start_tz = scheduled_start_tz.replace(tzinfo=timezone.utc)
    
    if scheduled_start_tz < (now - grace_period):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"No se puede asignar a una fecha pasada ({scheduled_start_tz.isoformat()})",
            headers={
                "X-Locked-Reason": "LOCKED_PAST_DATE",
                "X-Proposed-Date": scheduled_start_tz.isoformat(),
                "X-Current-Time": now.isoformat(),
            }
        )
    
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
    
    # 🔒 AUDIT LOG: Registrar asignación de OT
    try:
        log_update(
            db=db,
            user_id=current_user.id,
            entity_name="work_orders",
            entity_id=wo.id,
            old_values={"team_id": None, "status": WorkOrderStatus.pending_planning.value},
            new_values={
                "team_id": wo.team_id,
                "team_name": team.name,
                "scheduled_start": wo.scheduled_start.isoformat(),
                "status": wo.status.value
            }
        )
    except Exception as audit_error:
        logging.getLogger("uvicorn.error").error(f"❌ [AUDIT] Error al registrar asignación de OT {wo.id}: {audit_error}")
    
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
    """
    Devolver OT al backlog (quitar team).
    
    **Validaciones (NASA-grade):**
    - OTs completadas/fallidas no se pueden desasignar
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id)\
        .options(joinedload(WorkOrder.ticket)).first()
    
    if not wo:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    
    # ===== VALIDACIÓN: BLOQUEAR SI OT ESTÁ COMPLETADA =====
    validate_coordination_not_locked(wo, db, current_user, operation="unassign")
    
    old_team_id = wo.team_id
    old_team_name = wo.team.name if wo.team else "Unknown"
    
    # ===== LIMPIEZA AL DEVOLVER AL BACKLOG (NASA-grade consistency) =====
    wo.team_id = None
    wo.scheduled_start = None  # Limpiar fecha programada (sin equipo = sin programación)
    wo.status = WorkOrderStatus.pending_planning  # Vuelve a planning, debe recoordinarse
    
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


# ============================================================
# ENDPOINTS: Completar OT con inventario
# ============================================================


@router.post(
    "/{work_order_id}/complete",
    response_model=WorkOrderDetailResponse,
    status_code=status.HTTP_200_OK,
)
def complete_work_order(
    work_order_id: int,
    payload: WorkOrderCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Completar una OT procesando inventario y creando trazabilidad de activos.

    Este endpoint reemplaza el flujo anterior de PATCH con status=completed.
    Orquesta en una transacción:
      - Descarga de stock BULK del vehículo del técnico
      - Instalación de SERIALIZED (ConnectionAsset)
      - Registro de StockMovement (auditoría)
      - Timeline event
      - Nota de conexión (opcional)

    Si hay errores de inventario (stock insuficiente, serial no encontrado),
    la transacción se revierte y se retorna error 422.
    """
    # Mapear action_code → ResolutionCategory
    # Los action codes vienen del wizard paso 1 (WO Actions configurables)
    # y deben traducirse a los valores del enum ResolutionCategory.
    _ACTION_TO_CATEGORY = {
        "no_realizada": ResolutionCategory.incomplete,
    }
    raw_category = payload.resolution_category
    if raw_category and raw_category in _ACTION_TO_CATEGORY:
        resolved_category = _ACTION_TO_CATEGORY[raw_category]
    elif raw_category:
        # Intentar usar el valor directamente (si ya es un valor válido del enum)
        try:
            resolved_category = ResolutionCategory(raw_category)
        except (ValueError, LookupError):
            resolved_category = ResolutionCategory.other
    else:
        resolved_category = None

    # Cargar OT con items
    wo = (
        db.query(WorkOrder)
        .options(joinedload(WorkOrder.work_order_items))
        .filter(WorkOrder.id == work_order_id)
        .first()
    )
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder no encontrada")

    # Solo el técnico asignado o admin puede completar.
    # current_user.role es un objeto Role; comparar por su nombre y por is_superuser.
    role_name = current_user.role.name if current_user.role else None
    is_admin = role_name in ("admin", "super_user") or current_user.is_superuser
    if not is_admin:
        if wo.technician_id and wo.technician_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para completar esta OT",
            )

    # Idempotencia del cierre: si la clave ya fue usada en una OT cerrada, se
    # devuelve el resultado sin reprocesar (evita doble consumo ante reintentos).
    if payload.idempotency_key:
        existing = (
            db.query(WorkOrder)
            .filter(WorkOrder.close_idempotency_key == payload.idempotency_key)
            .first()
        )
        if existing and existing.status in (WorkOrderStatus.completed, WorkOrderStatus.failed):
            return get_work_order_detail(existing.id, db, current_user)

        wo.close_idempotency_key = payload.idempotency_key

    if payload.installation_connection_id:
        wo.installation_connection_id = payload.installation_connection_id

    try:
        wo = complete_work_order_with_inventory(
            db=db,
            work_order=wo,
            current_user=current_user,
            resolution_category=resolved_category.value if resolved_category else None,
            resolution_notes=payload.resolution_notes,
            photo_urls=payload.photo_urls,
            connection_note=payload.connection_note,
            installation_signal_dbm=payload.installation_signal_dbm,
            installation_connection_id=payload.installation_connection_id,
        )
    except CompletionError as e:
        # Registrar el detalle exacto del error para diagnóstico: el log HTTP
        # solo muestra "422 Unprocessable Entity" sin el motivo.
        logger.error(
            f"❌ [COMPLETE] Error al completar OT #{work_order_id}: {e}"
        )
        raise HTTPException(status_code=422, detail=str(e))

    db.commit()
    db.refresh(wo)

    # Audit log
    try:
        log_update(
            db=db,
            user_id=current_user.id,
            entity_name="work_orders",
            entity_id=wo.id,
            old_values={"status": "pending_completion"},
            new_values={
                "status": wo.status.value,
                "resolution_category": wo.resolution_category,
                "item_count": len(wo.work_order_items),
            },
        )
    except Exception as audit_error:
        logger.error(f"❌ [AUDIT] Error al registrar cierre de OT {wo.id}: {audit_error}")

    return get_work_order_detail(work_order_id, db, current_user)


# ============================================================
# ENDPOINTS: Connection Assets & Notes
# ============================================================


@router.get(
    "/{work_order_id}/connection-assets",
    response_model=ConnectionAssetsListResponse,
)
def get_work_order_connection_assets(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener los activos instalados/retirados en la conexión asociada a esta OT."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder no encontrada")

    ticket = db.query(Ticket).filter(Ticket.id == wo.ticket_id).first()
    connection_id = (
        (ticket.connection_id if ticket else None)
        or (ticket.destination_connection_id if ticket else None)
        or (ticket.origin_connection_id if ticket else None)
    )
    if not connection_id:
        return ConnectionAssetsListResponse(connection_id=0, assets=[])

    assets = (
        db.query(ConnectionAsset)
        .filter(ConnectionAsset.connection_id == connection_id)
        .order_by(ConnectionAsset.installed_at.desc())
        .all()
    )

    return ConnectionAssetsListResponse(
        connection_id=connection_id,
        assets=[ConnectionAssetResponse.model_validate(a) for a in assets],
    )


@router.get(
    "/{work_order_id}/connection-notes",
    response_model=ConnectionNotesListResponse,
)
def get_work_order_connection_notes(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener las notas de la conexión asociada a esta OT."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder no encontrada")

    ticket = db.query(Ticket).filter(Ticket.id == wo.ticket_id).first()
    if not ticket or not ticket.connection_id:
        return ConnectionNotesListResponse(connection_id=0, notes=[])

    notes = (
        db.query(ConnectionNote)
        .filter(ConnectionNote.connection_id == ticket.connection_id)
        .order_by(ConnectionNote.is_pinned.desc(), ConnectionNote.created_at.desc())
        .all()
    )

    return ConnectionNotesListResponse(
        connection_id=ticket.connection_id,
        notes=[ConnectionNoteResponse.model_validate(n) for n in notes],
    )


@router.post(
    "/connection-notes",
    response_model=ConnectionNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_connection_note(
    payload: ConnectionNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear una nota de conexión (sin necesidad de OT activa)."""
    note = ConnectionNote(
        connection_id=payload.connection_id,
        work_order_id=payload.work_order_id,
        author_id=current_user.id,
        note=payload.note,
        is_pinned=payload.is_pinned,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return ConnectionNoteResponse.model_validate(note)
