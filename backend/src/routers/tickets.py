"""Router para Tickets v2.0"""
from __future__ import annotations

from typing import List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File, Form
from sqlalchemy import select, text
from sqlalchemy.orm import Session, joinedload, selectinload

from src.database import get_db
from src.models import (
    Ticket,
    TicketTimeline,
    TicketTimelineEventType,
    WorkOrder,
    WorkOrderStatus,
    WorkOrderType,
    TicketPriority,
    TicketStatus,
    TicketType,
    AdministrativeSubtype,
    TicketAttachment,
    Tag,
    TicketCategory,
    TicketReason,
)
from src.schemas.tickets import (
    TicketCreate,
    TicketUpdate,
    TimelineEventCreate,
    TicketDetailResponse,
    TicketResponse,
    TimelineEventResponse,
    WorkOrderCreate,
    WorkOrderResponse,
    ConnectionDetailsResponse,
    TagResponse,
    TicketCategoryResponse,
    TicketReasonResponse,
)

router = APIRouter()

# ============================
# Categorías de Ticket
# ============================


@router.get("/categories", response_model=List[TicketCategoryResponse])
def list_ticket_categories(db: Session = Depends(get_db)):
    """Devuelve todas las categorías de tickets con prioridad por defecto."""
    stmt = select(TicketCategory).order_by(TicketCategory.name)
    result = db.execute(stmt).scalars().all()
    return result


@router.get("/reasons", response_model=List[TicketReasonResponse])
def list_ticket_reasons(
    category_id: Optional[int] = Query(None, description="Filtrar motivos por categoría"),
    db: Session = Depends(get_db)
):
    """
    Devuelve los motivos de ticket, opcionalmente filtrados por categoría.
    
    Si no se proporciona category_id, retorna todos los motivos.
    Si se proporciona, retorna solo los motivos de esa categoría específica.
    """
    stmt = select(TicketReason).order_by(TicketReason.name)
    
    if category_id is not None:
        stmt = stmt.where(TicketReason.category_id == category_id)
    
    result = db.execute(stmt).scalars().all()
    return result


# Traducciones para mensajes en español
STATUS_LABELS = {
    "open": "Abierto",
    "in_progress": "En progreso",
    "pending": "Pendiente",
    "pending_infra": "Pendiente Infra",
    "resolved": "Resuelto",
    "closed": "Cerrado",
}

PRIORITY_LABELS = {
    "low": "Baja",
    "medium": "Media",
    "high": "Alta",
    "critical": "Crítica",
}

# ============================================
# FILE & ATTACHMENT CONSTANTS & HELPERS
# ============================================

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx', '.xlsx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MEDIA_DIR = Path(__file__).parent.parent.parent / "media"


def _get_file_extension(filename: str) -> str:
    """Extrae extensión del archivo."""
    return Path(filename).suffix.lower()


def _validate_file(file: UploadFile) -> tuple[bool, str]:
    """Valida extensión del archivo."""
    ext = _get_file_extension(file.filename)
    
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Tipo de archivo no permitido. Extensiones válidas: {', '.join(ALLOWED_EXTENSIONS)}"
    
    return True, ""


def get_user_id(request: Request) -> int:
    actual_user_id = getattr(request.state, "user_id", None)
    auth_type = getattr(request.state, "auth_type", "NONE")
    
    # Log cuando se usa el fallback
    import logging
    logger = logging.getLogger("uvicorn.error")
    
    if not actual_user_id:
        logger.info(f"🔴 [TICKET AUTH] ❌ No se encontró user_id en request.state")
        logger.info(f"🔴 [TICKET AUTH] auth_type={auth_type}")
        logger.info(f"🔴 [TICKET AUTH] Usando fallback admin (ID=2)")
    else:
        logger.info(f"✅ [TICKET AUTH] user_id encontrado: {actual_user_id} (tipo={type(actual_user_id)}, auth={auth_type})")
    
    return actual_user_id if actual_user_id else 2  # Fallback a admin@emerald.com


def _safe_name(user) -> Optional[str]:
    if user is None:
        return None
    return user.full_name or user.username


def _ticket_to_response(
    ticket: Ticket,
    client_name: Optional[str] = None,
    client_dni: Optional[str] = None,
    connection_id_override: Optional[int] = None,
) -> TicketResponse:
    """Convierte Ticket ORM a respuesta enriquecida.

    connection_id_override permite mantener visibles los paneles de conexión
    en la UI incluso si el ticket usa destination_connection_id (instalación)
    o origin_connection_id (traslado) como única referencia.
    """
    return TicketResponse(
        id=ticket.id,
        subject=ticket.subject,
        status=ticket.status,
        priority=ticket.priority,
        ticket_type=ticket.ticket_type,
        administrative_subtype=ticket.administrative_subtype,
        connection_id=connection_id_override if connection_id_override is not None else ticket.connection_id,
        origin_connection_id=ticket.origin_connection_id,
        destination_connection_id=ticket.destination_connection_id,
        installation_tech=ticket.installation_tech,
        availability_note=ticket.availability_note,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        creator_name=_safe_name(ticket.creator),
        assigned_to_name=_safe_name(ticket.assigned_to),
        client_name=client_name,
        client_dni=client_dni,
        category_name=ticket.category.name if ticket.category else None,
        reason_name=ticket.reason.name if ticket.reason else None,
        tags=[TagResponse.model_validate(tag) for tag in ticket.tags] if ticket.tags else [],
    )


def _timeline_to_response(event: TicketTimeline, db: Optional[Session] = None) -> TimelineEventResponse:
    """Convierte TicketTimeline a response, enriqueciendo con datos dinámicos si es necesario.
    
    Para eventos de OT, trae el status ACTUAL de la orden, no el guardado históricamente.
    """
    meta = dict(event.meta_data) if event.meta_data else {}
    
    # Si es un evento de OT, traer el status actual de la orden
    if event.event_type == TicketTimelineEventType.ot_event and meta.get('work_order_id') and db:
        try:
            wo = db.get(WorkOrder, meta['work_order_id'])
            if wo:
                # Incluir status ACTUAL de la OT, no el que estaba cuando se creó
                meta['current_status'] = wo.status.value if hasattr(wo.status, 'value') else str(wo.status)
                meta['current_ot_type'] = wo.ot_type.value if hasattr(wo.ot_type, 'value') else str(wo.ot_type)
        except Exception:
            pass  # Silenciar errores para no romper el flujo
    
    return TimelineEventResponse(
        id=event.id,
        event_type=event.event_type,
        content=event.content,
        created_at=event.created_at,
        author_name=_safe_name(event.author),
        meta_data=meta,
    )


def _workorder_to_response(wo: WorkOrder) -> WorkOrderResponse:
    return WorkOrderResponse(
        id=wo.id,
        status=wo.status,
        ot_type=wo.ot_type,
        technician_name=_safe_name(wo.technician),
        scheduled_at=wo.scheduled_at,
    )


# ============== ENDPOINTS PARA WIZARDS ==============

@router.get("/search-connections", response_model=List[dict])
def search_connections(
    query: str = Query(..., description="Texto a buscar (nombre, dirección, username, DNI)"),
    limit: int = Query(20, ge=1, le=100),
    source: str = Query("mixed", pattern="^(local|mixed)$", description="local: solo DB Emerald; mixed: DB y fallback ISPCube"),
    db: Session = Depends(get_db),
):
    """
    Busca conexiones priorizando la DB local de Emerald.
    Si `source` es mixed y la DB no devuelve resultados, usa ISPCube como fallback.
    """
    from sqlalchemy import text

    try:
        search_term = f"%{query}%"
        db_results = db.execute(
            text(
                """
                SELECT 
                    c.connection_id,
                    c.pppoe_username,
                    COALESCE(c.direccion, cl.address, 'Sin dirección') as installation_address,
                    cl.name as client_name,
                    cl.id as client_id,
                    cl.doc_number as client_dni
                FROM connections c
                LEFT JOIN clientes cl ON c.customer_id = cl.id
                WHERE 
                    cl.name ILIKE :search
                    OR cl.doc_number ILIKE :search
                    OR c.pppoe_username ILIKE :search
                    OR c.direccion ILIKE :search
                LIMIT :limit
                """
            ),
            {"search": search_term, "limit": limit},
        ).fetchall()

        if db_results:
            return [
                {
                    "connection_id": row[0],
                    "pppoe_username": row[1],
                    "installation_address": row[2],
                    "client_name": row[3] or "Cliente sin nombre",
                    "client_id": row[4],
                    "client_dni": row[5],
                    "plan_name": "N/A",
                    "node_name": "N/A",
                    "status": "active",
                }
                for row in db_results
            ]

        # Si se pidió solo DB, devolver vacío
        if source == "local":
            return []

        # Fallback a ISPCube solo si se solicita mixed
        try:
            from src.clients.ispcube import buscar_conexiones

            external_results = buscar_conexiones(query, limit)
        except Exception:
            external_results = []

        if not external_results:
            return []

        enriched_results = []
        for result in external_results:
            try:
                db_result = db.execute(
                    text(
                        """
                        SELECT 
                            cl.name,
                            cl.doc_number
                        FROM connections c
                        LEFT JOIN clientes cl ON c.customer_id = cl.id
                        WHERE c.connection_id = :conn_id
                        LIMIT 1
                        """
                    ),
                    {"conn_id": result.get("connection_id")},
                ).first()

                if db_result and db_result[1]:
                    result["client_dni"] = db_result[1]
                    result["client_name"] = db_result[0] or result.get("client_name", "Cliente sin nombre")
            except Exception:
                pass

            enriched_results.append(result)

        return enriched_results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error buscando conexiones: {str(e)}",
        )


@router.get("/", response_model=dict)
@router.get("", response_model=dict)
def list_tickets(
    status: Optional[TicketStatus] = Query(None),
    priority: Optional[TicketPriority] = Query(None),
    search: Optional[str] = Query(None, description="Buscar por nombre de cliente, DNI o asunto"),
    order_by: str = Query("created_at", description="Campo para ordenar: id, status, priority, created_at"),
    order_dir: str = Query("desc", description="Dirección de ordenamiento: asc o desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tags: Optional[List[int]] = Query(None, description="IDs de etiquetas (OR)"),
    db: Session = Depends(get_db),
):
    """Lista tickets con filtros optimizados."""
    
    # Construir query principal con ORM
    query = db.query(Ticket).options(
        selectinload(Ticket.tags),
        selectinload(Ticket.creator),
        selectinload(Ticket.assigned_to),
    )
    
    # Aplicar filtros
    if status:
        query = query.filter(Ticket.status == status)
    
    if priority:
        query = query.filter(Ticket.priority == priority)
    
    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.filter(
            (Ticket.subject.ilike(search_pattern))
        )
    
    # Filtro de tags (OR logic)
    if tags:
        query = query.filter(Ticket.tags.any(Tag.id.in_(tags)))
    
    # Ordenamiento seguro
    allowed_order_fields = {
        "id": Ticket.id,
        "status": Ticket.status,
        "priority": Ticket.priority,
        "created_at": Ticket.created_at,
        "updated_at": Ticket.updated_at,
    }
    
    order_column = allowed_order_fields.get(order_by, Ticket.created_at)
    if order_dir.lower() == "asc":
        query = query.order_by(order_column.asc())
    else:
        query = query.order_by(order_column.desc())
    
    # Paginar - obtener limit+1 para saber si hay más
    tickets = query.offset(offset).limit(limit + 1).all()
    
    # Determinar si hay más resultados
    has_more = len(tickets) > limit
    if has_more:
        tickets = tickets[:limit]
    
    # Convertir a response, enriqueciendo con datos de conexión
    response_list = []
    for t in tickets:
        client_name = None
        client_dni = None
        
        # Enriquecer con datos de conexión si existe
        if t.connection_id:
            try:
                conn_row = db.execute(
                    text(
                        """
                        SELECT 
                            cl.name as client_name,
                            cl.doc_number as client_dni
                        FROM connections c
                        LEFT JOIN clientes cl ON c.customer_id = cl.id
                        WHERE c.connection_id = :conn_id
                        LIMIT 1
                        """
                    ),
                    {"conn_id": t.connection_id},
                ).first()
                
                if conn_row:
                    client_name = conn_row[0]
                    client_dni = conn_row[1]
            except Exception:
                # Si falla la consulta, usar None
                pass
        
        response_list.append(
            TicketResponse(
                id=t.id,
                subject=t.subject,
                status=t.status,
                priority=t.priority,
                ticket_type=t.ticket_type,
                administrative_subtype=t.administrative_subtype,
                connection_id=t.connection_id,
                origin_connection_id=t.origin_connection_id,
                destination_connection_id=t.destination_connection_id,
                installation_tech=t.installation_tech,
                availability_note=t.availability_note,
                created_at=t.created_at,
                updated_at=t.updated_at,
                creator_name=_safe_name(t.creator),
                assigned_to_name=_safe_name(t.assigned_to),
                client_name=client_name,
                client_dni=client_dni,
                tags=[TagResponse.model_validate(tag) for tag in t.tags] if t.tags else [],
            )
        )
    
    # Usar -1 para total desconocido si hay filtros
    total_count = -1 if (status or priority or search or tags) else len(response_list)
    
    return {
        "items": response_list,
        "total": total_count,
        "limit": limit,
        "offset": offset,
    }


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """
    Crear nuevo ticket con soporte para 5 flujos de negocio.
    
    Validaciones según tipo:
    - TECHNICAL: requiere connection_id
    - INSTALLATION: requiere destination_connection_id e installation_tech
    - WITHDRAWAL: requiere connection_id
    - RELOCATION: requiere origin_connection_id y destination_connection_id
    - ADMINISTRATIVE: requiere administrative_subtype
    """
    
    # Validaciones por tipo
    if payload.ticket_type == TicketType.technical:
        if not payload.connection_id:
            raise HTTPException(
                status_code=400,
                detail="Tickets técnicos requieren connection_id"
            )
    
    elif payload.ticket_type == TicketType.installation:
        if not payload.destination_connection_id:
            raise HTTPException(
                status_code=400,
                detail="Instalaciones requieren destination_connection_id"
            )
        if not payload.installation_tech:
            raise HTTPException(
                status_code=400,
                detail="Instalaciones requieren especificar tecnología (fiber/wireless/hybrid)"
            )
    
    elif payload.ticket_type == TicketType.withdrawal:
        if not payload.connection_id:
            raise HTTPException(
                status_code=400,
                detail="Retiros requieren connection_id de la conexión a dar de baja"
            )
    
    elif payload.ticket_type == TicketType.relocation:
        if not payload.origin_connection_id:
            raise HTTPException(
                status_code=400,
                detail="Traslados requieren origin_connection_id"
            )
        if not payload.destination_connection_id and not payload.availability_note:
            raise HTTPException(
                status_code=400,
                detail="Traslados requieren destination_connection_id o dirección de destino en availability_note"
            )
    
    elif payload.ticket_type == TicketType.administrative:
        # Para tickets administrativos, aceptar tanto administrative_subtype (legacy) como ticket_reason_id (nuevo sistema)
        if not payload.administrative_subtype and not payload.ticket_reason_id:
            raise HTTPException(
                status_code=400,
                detail="Tickets administrativos requieren administrative_subtype o ticket_reason_id"
            )
    
    category = None
    if payload.category_id:
        category = db.get(TicketCategory, payload.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Categoría de ticket no encontrada")
    
    # Validar motivo si se proporciona
    if payload.ticket_reason_id:
        reason = db.get(TicketReason, payload.ticket_reason_id)
        if not reason:
            raise HTTPException(status_code=404, detail="Motivo de ticket no encontrado")
        # Validar que el motivo pertenezca a la categoría seleccionada
        if payload.category_id and reason.category_id != payload.category_id:
            raise HTTPException(
                status_code=400, 
                detail="El motivo seleccionado no pertenece a la categoría del ticket"
            )

    ticket_priority = payload.priority or (category.priority_default if category else TicketPriority.medium)

    # Crear ticket
    ticket = Ticket(
        subject=payload.subject,
        description=payload.description,
        priority=ticket_priority,
        status=TicketStatus.open,
        ticket_type=payload.ticket_type,
        administrative_subtype=payload.administrative_subtype,
        connection_id=payload.connection_id,
        origin_connection_id=payload.origin_connection_id,
        destination_connection_id=payload.destination_connection_id,
        installation_tech=payload.installation_tech,
        availability_note=payload.availability_note,
        category_id=payload.category_id,
        ticket_reason_id=payload.ticket_reason_id,
        creator_id=user_id,
    )
    
    db.add(ticket)
    db.flush()
    
    # Si es instalación, sincronizar cliente + conexión desde ISPCube a Postgres
    if payload.ticket_type == TicketType.installation:
        try:
            from src.clients import ispcube
            from src.db.postgres import Database

            db_sync = Database()

            # Camino preferido: usar payload del wizard (no re-consultar)
            if payload.ispcube_customer:
                try:
                    selected_conn = None
                    if payload.destination_connection_id and (payload.ispcube_connections or []):
                        for conn in payload.ispcube_connections:
                            if str(conn.get("id")) == str(payload.destination_connection_id):
                                selected_conn = conn
                                break
                    connections_to_sync = [selected_conn] if selected_conn else (payload.ispcube_connections or [])
                    db_sync.sync_cliente_instalacion(
                        customer_data=payload.ispcube_customer,
                        connections_data=connections_to_sync
                    )
                except Exception as inner_e:
                    from src.config import logger
                    logger.warning(f"Sync (wizard payload) falló para ticket {ticket.id}: {inner_e}")

            elif payload.customer_dni:
                # Camino preferido: lookup directo por DNI (retorna cliente y conexiones)
                pack = ispcube.obtener_cliente_por_dni(payload.customer_dni)
                if pack and pack.get("customer"):
                    db_sync.sync_cliente_instalacion(
                        customer_data=pack.get("customer"),
                        connections_data=pack.get("connections") or []
                    )
            elif payload.destination_connection_id:
                # Fallback: obtener la conexión y usar customer_id para lookup por ID
                todas_conexiones = ispcube.obtener_todas_conexiones()
                conexion_data = next(
                    (c for c in todas_conexiones if c.get("id") == payload.destination_connection_id),
                    None
                )
                if conexion_data and conexion_data.get("customer_id"):
                    cliente_pack = ispcube.obtener_cliente_por_id(int(conexion_data.get("customer_id")))
                    if cliente_pack and cliente_pack.get("customer"):
                        db_sync.sync_cliente_instalacion(
                            customer_data=cliente_pack.get("customer"),
                            connections_data=[conexion_data]
                        )

            db_sync.close()
        except Exception as e:
            # No fallar la creación del ticket si falla la sincronización
            from src.config import logger
            logger.warning(f"Error sincronizando cliente para ticket {ticket.id}: {e}")
    
    # Crear evento de timeline para creación del ticket
    ticket_created_event = TicketTimeline(
        ticket_id=ticket.id,
        author_id=user_id,
        event_type=TicketTimelineEventType.status_change,
        content="Ticket creado",
        meta_data={
            "ticket_type": payload.ticket_type.value,
            "administrative_subtype": payload.administrative_subtype.value if payload.administrative_subtype else None,
        },
    )
    db.add(ticket_created_event)
    
    # Si hay descripción, crear un segundo evento con el motivo como encabezado
    if payload.description and payload.description.strip():
        # Obtener el nombre del motivo si existe
        reason_header = "Descripción"
        if payload.ticket_reason_id:
            reason = db.get(TicketReason, payload.ticket_reason_id)
            if reason:
                reason_header = reason.name
        
        description_event = TicketTimeline(
            ticket_id=ticket.id,
            author_id=user_id,
            event_type=TicketTimelineEventType.note,
            content=f"{reason_header}\n{payload.description}",
            meta_data={
                "reason_id": payload.ticket_reason_id,
                "is_initial_description": True,
            },
        )
        db.add(description_event)
    
    # Auto-crear OT según tipo
    if payload.ticket_type in [TicketType.installation, TicketType.withdrawal, TicketType.relocation]:
        ot_type_map = {
            TicketType.installation: WorkOrderType.install,
            TicketType.withdrawal: WorkOrderType.pickup,
            TicketType.relocation: WorkOrderType.install,
        }
        
        # Nota más descriptiva para la OT (reutiliza la descripción del ticket)
        wo_note = payload.description or (
            f"Traslado desde conexión {payload.origin_connection_id} hacia "
            f"{payload.destination_connection_id or 'destino manual'}"
        )
        if payload.availability_note:
            wo_note = f"{wo_note} | Disponibilidad: {payload.availability_note}"

        work_order = WorkOrder(
            ticket_id=ticket.id,
            ot_type=ot_type_map[payload.ticket_type],
            status=WorkOrderStatus.pending_planning,
            notes=wo_note,
            custom_data={
                "ticket_type": payload.ticket_type.value,
                "installation_tech": payload.installation_tech,
                "origin_connection_id": payload.origin_connection_id,
                "destination_connection_id": payload.destination_connection_id,
            }
        )
        db.add(work_order)
        db.flush()
        
        # Timeline de OT creada
        ot_timeline = TicketTimeline(
            ticket_id=ticket.id,
            author_id=user_id,
            event_type=TicketTimelineEventType.ot_event,
            content=wo_note,
            meta_data={"work_order_id": work_order.id},
        )
        db.add(ot_timeline)
    
    db.commit()
    db.refresh(ticket)
    db.refresh(ticket, attribute_names=["creator", "assigned_to"])
    return _ticket_to_response(ticket)



@router.get("/by-connection/{connection_id}", response_model=List[TicketResponse])
def get_tickets_by_connection(
    connection_id: int,
    limit: int = Query(5, ge=1, le=20),
    exclude_ticket_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Obtener historial de tickets de una conexión específica.
    
    Args:
        connection_id: ID de la conexión
        limit: Cantidad máxima de tickets a retornar (default 5)
        exclude_ticket_id: ID de ticket a excluir (generalmente el ticket actual)
    
    Returns:
        Lista de tickets ordenados por fecha descendente (más recientes primero)
    """
    stmt = (
        select(Ticket)
        .where(Ticket.connection_id == connection_id)
        .options(joinedload(Ticket.creator), joinedload(Ticket.assigned_to))
        .order_by(Ticket.created_at.desc())
    )
    
    if exclude_ticket_id:
        stmt = stmt.where(Ticket.id != exclude_ticket_id)
    
    tickets = db.execute(stmt.limit(limit)).scalars().all()
    return [_ticket_to_response(t) for t in tickets]


@router.get("/{ticket_id}/", response_model=TicketDetailResponse)
@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket_detail(ticket_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            joinedload(Ticket.creator),
            joinedload(Ticket.assigned_to),
            selectinload(Ticket.timeline),
            selectinload(Ticket.work_orders).joinedload(WorkOrder.technician),
        )
    )
    ticket = db.execute(stmt).scalars().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    timeline_events = sorted(ticket.timeline, key=lambda ev: ev.created_at)
    # Pasar db a _timeline_to_response para que pueda traer estados dinámicos de OTs
    timeline = [_timeline_to_response(ev, db) for ev in timeline_events]
    work_orders = [_workorder_to_response(wo) for wo in ticket.work_orders]

    # Enriquecer con datos de la conexión (si existe)
    effective_connection_id = (
        ticket.connection_id
        or ticket.destination_connection_id
        or ticket.origin_connection_id
    )

    connection_details = None
    if effective_connection_id:
        conn_data = db.execute(
            text("""
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
            """),
            {"conn_id": effective_connection_id}
        ).first()
        
        if conn_data:
            connection_details = ConnectionDetailsResponse(
                connection_id=conn_data[0],
                pppoe_username=conn_data[1],
                address=conn_data[2],
                client_name=conn_data[3],
                client_dni=conn_data[4],
                node_name=conn_data[5],
                node_ip=conn_data[6],
                plan_name=conn_data[7],
                plan_speed=conn_data[8],
                phone=conn_data[9],
            )

    return TicketDetailResponse(
        **_ticket_to_response(
            ticket,
            client_name=connection_details.client_name if connection_details else None,
            client_dni=connection_details.client_dni if connection_details else None,
            connection_id_override=effective_connection_id,
        ).model_dump(),
        connection_details=connection_details,
        timeline=timeline,
        work_orders=work_orders,
    )


@router.post("/{ticket_id}/work-orders/", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{ticket_id}/work-orders", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    ticket_id: int,
    payload: WorkOrderCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    work_order = WorkOrder(
        ticket_id=ticket.id,
        ot_type=payload.ot_type,
        status=WorkOrderStatus.pending_planning,
        notes=payload.notes,
    )
    db.add(work_order)
    db.flush()

    timeline_event = TicketTimeline(
        ticket_id=ticket.id,
        author_id=user_id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"Orden de trabajo generada ({payload.ot_type.value})",
        meta_data={
            "work_order_id": work_order.id,
            "ot_type": payload.ot_type.value,
        },
    )
    db.add(timeline_event)

    db.commit()
    db.refresh(work_order)
    db.refresh(work_order, attribute_names=["technician"])
    return _workorder_to_response(work_order)


@router.patch("/{ticket_id}/", response_model=TicketResponse)
@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """Actualización parcial de un ticket."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Actualizar solo los campos que vienen en el payload
    changes = []
    if payload.priority is not None and payload.priority != ticket.priority:
        old_label = PRIORITY_LABELS.get(ticket.priority.value, ticket.priority.value)
        new_label = PRIORITY_LABELS.get(payload.priority.value, payload.priority.value)
        ticket.priority = payload.priority
        changes.append(f"Prioridad cambiada de {old_label} a {new_label}")
    
    if payload.status is not None and payload.status != ticket.status:
        old_label = STATUS_LABELS.get(ticket.status.value, ticket.status.value)
        new_label = STATUS_LABELS.get(payload.status.value, payload.status.value)
        ticket.status = payload.status
        changes.append(f"Estado cambiado de {old_label} a {new_label}")
    
    if payload.assigned_to_id is not None:
        old_user = ticket.assigned_to
        ticket.assigned_to_id = payload.assigned_to_id
        db.flush()
        db.refresh(ticket, attribute_names=["assigned_to"])
        new_name = _safe_name(ticket.assigned_to) if ticket.assigned_to else "Sin asignar"
        old_name = _safe_name(old_user) if old_user else "Sin asignar"
        changes.append(f"Asignado cambiado de {old_name} a {new_name}")

    if payload.availability_note is not None and payload.availability_note != ticket.availability_note:
        old_value = ticket.availability_note or "Sin nota"
        new_value = payload.availability_note or "Sin nota"
        ticket.availability_note = payload.availability_note
        changes.append(f"Disponibilidad actualizada: {old_value} -> {new_value}")

    # Crear evento en el timeline si hubo cambios
    if changes:
        timeline_event = TicketTimeline(
            ticket_id=ticket.id,
            author_id=user_id,
            event_type=TicketTimelineEventType.status_change,
            content=". ".join(changes),
            meta_data=None,
        )
        db.add(timeline_event)

    db.commit()
    db.refresh(ticket, attribute_names=["creator", "assigned_to"])
    return _ticket_to_response(ticket)


@router.post("/{ticket_id}/timeline/", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{ticket_id}/timeline", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
async def create_timeline_event_with_attachments(
    ticket_id: int,
    content: str = Form(..., min_length=1, description="Contenido de la nota"),
    files: Optional[List[UploadFile]] = File(None, description="Archivos adjuntos opcionales"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """
    Crear un evento NOTE en la cronología con opción de archivos adjuntos.
    
    Multipart Form Data:
    - content: str - Texto de la nota (requerido)
    - files: List[UploadFile] - Archivos adjuntos (opcional)
    
    Lógica Atómica:
    1. Valida ticket existe
    2. Valida y guarda archivos en disco
    3. Crea registros en TicketAttachment
    4. Crea UN SOLO evento NOTE con meta_data.attachments
    5. Retorna evento con lista de adjuntos
    """
    # Validar ticket existe
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket no encontrado"
        )
    
    # Procesar archivos
    attachments_list = []
    
    if files and len(files) > 0:
        # Crear directorio para este ticket
        ticket_media_dir = MEDIA_DIR / "tickets" / str(ticket_id)
        ticket_media_dir.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            if not file.filename:
                continue
            
            # Validar extensión
            is_valid, error_msg = _validate_file(file)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )
            
            # Leer contenido
            try:
                file_content = await file.read()
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error al leer archivo: {str(e)}"
                )
            
            # Validar tamaño
            if len(file_content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Archivo {file.filename} muy grande (máx 10MB)"
                )
            
            # Generar nombre único
            unique_id = str(uuid.uuid4())[:8]
            safe_filename = Path(file.filename).stem.replace(" ", "_")
            ext = _get_file_extension(file.filename)
            unique_filename = f"{unique_id}_{safe_filename}{ext}"
            
            # Rutas
            relative_path = f"tickets/{ticket_id}/{unique_filename}"
            full_path = ticket_media_dir / unique_filename
            
            # Guardar en disco
            try:
                with open(full_path, "wb") as f:
                    f.write(file_content)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error al guardar archivo: {str(e)}"
                )
            
            # Crear registro en TicketAttachment
            attachment = TicketAttachment(
                ticket_id=ticket_id,
                uploader_id=user_id,
                filename=file.filename,
                filepath=relative_path,
                content_type=file.content_type or "application/octet-stream",
                size=len(file_content),
            )
            db.add(attachment)
            db.flush()  # Para obtener el ID
            
            # Agregar a lista para meta_data
            attachments_list.append({
                "id": attachment.id,
                "name": file.filename,
                "url": f"/media/{relative_path}",
                "type": file.content_type or "application/octet-stream",
                "size": len(file_content),
            })
    
    # Crear evento TIMELINE
    timeline_event = TicketTimeline(
        ticket_id=ticket_id,
        author_id=user_id,
        event_type=TicketTimelineEventType.note,
        content=content.strip(),
        meta_data={
            "attachments": attachments_list
        } if attachments_list else None,
    )
    db.add(timeline_event)
    db.commit()
    db.refresh(timeline_event, attribute_names=["author"])
    return _timeline_to_response(timeline_event)


# ============================================
# ATTACHMENT ENDPOINTS
# ============================================


@router.post(
    "/{ticket_id}/attachments",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/{ticket_id}/attachments/",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def upload_ticket_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """
    Subir archivo adjunto a un ticket.
    
    - Valida extensión y tamaño
    - Guarda en disco: /media/tickets/{ticket_id}/{uuid}_{filename}
    - Crea registro en TicketAttachment
    - Crea automáticamente evento FILE en timeline
    
    Máximo: 10MB
    Tipos permitidos: jpg, jpeg, png, gif, pdf, txt, doc, docx, xlsx
    """
    # Verificar que ticket existe
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Validar archivo
    is_valid, error_msg = _validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Leer contenido y validar tamaño
    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Archivo muy grande. Máximo: 10MB, recibido: {len(content) / 1024 / 1024:.2f}MB"
            )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    # Crear directorio si no existe
    ticket_media_dir = MEDIA_DIR / "tickets" / str(ticket_id)
    ticket_media_dir.mkdir(parents=True, exist_ok=True)
    
    # Generar nombre único
    unique_id = str(uuid.uuid4())[:8]
    safe_filename = Path(file.filename).stem.replace(" ", "_")
    ext = _get_file_extension(file.filename)
    unique_filename = f"{unique_id}_{safe_filename}{ext}"
    
    # Ruta relativa para guardar en DB
    relative_path = f"tickets/{ticket_id}/{unique_filename}"
    full_path = ticket_media_dir / unique_filename
    
    # Guardar archivo en disco
    try:
        with open(full_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar archivo: {str(e)}"
        )
    
    # Crear registro en TicketAttachment
    attachment = TicketAttachment(
        ticket_id=ticket_id,
        uploader_id=user_id,
        filename=file.filename,
        filepath=relative_path,
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
    )
    db.add(attachment)
    db.flush()  # Para obtener el ID
    
    # Crear evento en timeline
    timeline_event = TicketTimeline(
        ticket_id=ticket_id,
        author_id=user_id,
        event_type=TicketTimelineEventType.file,
        content=f"Adjuntó archivo: {file.filename}",
        meta_data={
            "attachment_id": attachment.id,
            "filename": file.filename,
            "filepath": f"/media/{relative_path}",
            "content_type": file.content_type or "application/octet-stream",
            "size": len(content),
        },
    )
    db.add(timeline_event)
    db.commit()
    db.refresh(attachment, attribute_names=["uploader"])
    
    return {
        "success": True,
        "attachment": {
            "id": attachment.id,
            "filename": attachment.filename,
            "filepath": attachment.filepath,
            "content_type": attachment.content_type,
            "size": attachment.size,
            "url": f"/media/{relative_path}",
            "uploader_name": _safe_name(attachment.uploader),
            "created_at": attachment.created_at.isoformat(),
        },
        "event": _timeline_to_response(timeline_event),
    }

