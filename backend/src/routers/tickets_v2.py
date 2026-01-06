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
    TicketPriority,
    TicketStatus,
    TicketAttachment,
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
)

router = APIRouter()

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
    return getattr(request.state, "user_id", 2)  # User admin@emerald.com


def _safe_name(user) -> Optional[str]:
    if user is None:
        return None
    return user.full_name or user.username


def _ticket_to_response(ticket: Ticket, client_name: Optional[str] = None, client_dni: Optional[str] = None) -> TicketResponse:
    return TicketResponse(
        id=ticket.id,
        subject=ticket.subject,
        status=ticket.status,
        priority=ticket.priority,
        connection_id=ticket.connection_id,
        availability_note=ticket.availability_note,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        creator_name=_safe_name(ticket.creator),
        assigned_to_name=_safe_name(ticket.assigned_to),
        client_name=client_name,
        client_dni=client_dni,
        tags=[TagResponse.model_validate(tag) for tag in ticket.tags] if ticket.tags else [],
    )


def _timeline_to_response(event: TicketTimeline) -> TimelineEventResponse:
    return TimelineEventResponse(
        id=event.id,
        event_type=event.event_type,
        content=event.content,
        created_at=event.created_at,
        author_name=_safe_name(event.author),
        meta_data=event.meta_data,
    )


def _workorder_to_response(wo: WorkOrder) -> WorkOrderResponse:
    return WorkOrderResponse(
        id=wo.id,
        status=wo.status,
        ot_type=wo.ot_type,
        technician_name=_safe_name(wo.technician),
        scheduled_at=wo.scheduled_at,
    )


@router.get("/", response_model=dict)
@router.get("", response_model=dict)
def list_tickets(
    status: Optional[TicketStatus] = Query(None),
    priority: Optional[TicketPriority] = Query(None),
    search: Optional[str] = Query(None, description="Buscar por nombre de cliente, DNI o asunto"),
    order_by: str = Query("created_at", description="Campo para ordenar: id, status, priority, created_at, client_name"),
    order_dir: str = Query("desc", description="Dirección de ordenamiento: asc o desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tags: Optional[List[int]] = Query(None, description="IDs de etiquetas (OR)"),
    db: Session = Depends(get_db),
):
    # Mapeo de campos para ordenamiento seguro con lógica semántica
    allowed_order_fields = {
        "id": "t.id",
        "status": """CASE t.status 
            WHEN 'open' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'pending' THEN 3
            WHEN 'pending_infra' THEN 4
            WHEN 'resolved' THEN 5
            WHEN 'closed' THEN 6
        END""",
        "priority": """CASE t.priority 
            WHEN 'low' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'high' THEN 3
            WHEN 'critical' THEN 4
        END""",
        "created_at": "t.created_at",
        "updated_at": "t.updated_at",
        "client_name": "cl.name",
    }
    
    # Validar campo de ordenamiento
    order_field = allowed_order_fields.get(order_by, "t.created_at")
    order_direction = "ASC" if order_dir.lower() == "asc" else "DESC"
    
    # Query con JOIN para obtener datos del cliente
    query_parts = []
    params: dict = {"limit": limit, "offset": offset}
    
    # Base query
    base_query = """
        SELECT 
            t.id, t.subject, t.status, t.priority, t.connection_id, 
            t.availability_note, t.created_at, t.updated_at, t.creator_id, t.assigned_to_id,
            cl.name as client_name, cl.doc_number as client_dni,
            u1.username as creator_username, u1.full_name as creator_fullname,
            u2.username as assigned_username, u2.full_name as assigned_fullname
        FROM tickets_v2 t
        LEFT JOIN connections c ON t.connection_id = c.connection_id
        LEFT JOIN clientes cl ON c.customer_id = cl.id
        LEFT JOIN users u1 ON t.creator_id = u1.id
        LEFT JOIN users u2 ON t.assigned_to_id = u2.id
        WHERE 1=1
    """
    
    # Filtros dinámicos
    if status:
        query_parts.append("AND t.status = :status")
        params["status"] = status.value
    
    if priority:
        query_parts.append("AND t.priority = :priority")
        params["priority"] = priority.value
    
    if search:
        query_parts.append("AND (LOWER(t.subject) LIKE :search OR LOWER(cl.name) LIKE :search OR LOWER(cl.doc_number) LIKE :search)")
        params["search"] = f"%{search.lower()}%"

    if tags:
        query_parts.append("AND t.id IN (SELECT tt.ticket_id FROM ticket_tags tt WHERE tt.tag_id = ANY(:tags_array))")
        params["tags_array"] = tags
    
    # Query para contar total
    count_query = f"""
        SELECT COUNT(*) as total
        FROM tickets_v2 t
        LEFT JOIN connections c ON t.connection_id = c.connection_id
        LEFT JOIN clientes cl ON c.customer_id = cl.id
        WHERE 1=1 {" ".join(query_parts)}
    """
    
    total_result = db.execute(text(count_query), params).fetchone()
    total_count = total_result[0] if total_result else 0
    
    # Construir query final con ordenamiento
    final_query = base_query + " " + " ".join(query_parts) + f" ORDER BY {order_field} {order_direction} LIMIT :limit OFFSET :offset"
    
    results = db.execute(text(final_query), params).fetchall()

    # Cargar tags asociados para los tickets devueltos
    ticket_ids = [row.id for row in results]
    tags_by_ticket: dict[int, list[Tag]] = {}
    if ticket_ids:
        tickets_with_tags = (
            db.query(Ticket)
            .options(selectinload(Ticket.tags))
            .filter(Ticket.id.in_(ticket_ids))
            .all()
        )
        tags_by_ticket = {t.id: t.tags for t in tickets_with_tags}

    # Convertir resultados a TicketResponse
    response_list = []
    for row in results:
        creator_name = row.creator_fullname or row.creator_username if row.creator_username else None
        assigned_name = row.assigned_fullname or row.assigned_username if row.assigned_username else None
        
        response_list.append(TicketResponse(
            id=row.id,
            subject=row.subject,
            status=TicketStatus(row.status),
            priority=TicketPriority(row.priority),
            connection_id=row.connection_id,
            availability_note=row.availability_note,
            created_at=row.created_at,
            updated_at=row.updated_at,
            creator_name=creator_name,
            assigned_to_name=assigned_name,
            client_name=row.client_name,
            client_dni=row.client_dni,
            tags=[TagResponse.model_validate(tag) for tag in tags_by_ticket.get(row.id, [])],
        ))
    
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
    ticket = Ticket(
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority,
        connection_id=payload.connection_id,
        availability_note=payload.availability_note,
        creator_id=user_id,
    )
    db.add(ticket)
    db.flush()

    first_note = TicketTimeline(
        ticket_id=ticket.id,
        author_id=user_id,
        event_type=TicketTimelineEventType.note,
        content=payload.description or "Ticket creado",
        meta_data=None,
    )
    db.add(first_note)

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
    timeline = [_timeline_to_response(ev) for ev in timeline_events]
    work_orders = [_workorder_to_response(wo) for wo in ticket.work_orders]

    # Enriquecer con datos de la conexión (si existe)
    connection_details = None
    if ticket.connection_id:
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
            {"conn_id": ticket.connection_id}
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
        **_ticket_to_response(ticket).model_dump(),
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

