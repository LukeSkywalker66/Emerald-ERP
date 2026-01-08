# Attachment upload endpoint - Agregar al final de tickets_v2.py

# Validación de archivos
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx', '.xlsx'}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

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
            "url": f"/media/{relative_path}",
            "type": file.content_type or "application/octet-stream",
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
