"""
Adjuntos de tickets — Endpoints para subida y gestión de archivos.

Almacenamiento: MinIO (S3-compatible) vía StorageService.
Reemplaza la escritura directa en backend/media/.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models import Ticket, TicketAttachment, TicketTimeline, TicketTimelineEventType
from src.routers.tickets import _safe_name, _timeline_to_response, get_user_id
from src.services.storage_service import get_storage

router = APIRouter()

# ── Validación de archivos ──────────────────────────────────────────────────

ALLOWED_EXTENSIONS: set[str] = {
    ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".txt", ".doc", ".docx", ".xlsx",
}
MAX_FILE_SIZE: int = 20 * 1024 * 1024  # 20 MB


def _get_file_extension(filename: str) -> str:
    """Extrae extensión del archivo en minúsculas."""
    return Path(filename).suffix.lower()


def _validate_file(file: UploadFile) -> tuple[bool, str]:
    """Valida extensión del archivo."""
    ext = _get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return False, (
            f"Tipo de archivo no permitido. "
            f"Extensiones válidas: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    return True, ""


# ── Endpoints ────────────────────────────────────────────────────────────────


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
    Subir archivo adjunto a un ticket usando MinIO.

    - Valida extensión y tamaño (máx. 20 MB).
    - Almacena en MinIO bajo la key tickets/{ticket_id}/{uuid}_{filename}.
    - Crea registro en TicketAttachment y evento FILE en el timeline.
    """
    # 1. Verificar que el ticket existe
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    # 2. Validar extensión
    is_valid, error_msg = _validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    # 3. Leer contenido y validar tamaño
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al leer el archivo: {str(e)}",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Archivo muy grande. "
                f"Máximo: {MAX_FILE_SIZE // 1024 // 1024} MB, "
                f"recibido: {len(content) / 1024 / 1024:.2f} MB"
            ),
        )

    # 4. Subir a MinIO vía StorageService
    storage = get_storage()
    object_name, short_uuid = storage.generate_unique_object_name(
        ticket_id, file.filename
    )

    try:
        storage.upload_file(
            file_content=content,
            object_name=object_name,
            content_type=file.content_type or "application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar archivo en storage: {str(e)}",
        )

    # 5. Generar URL pública
    file_url = storage.get_file_url(object_name)

    # 6. Crear registro en TicketAttachment
    attachment = TicketAttachment(
        ticket_id=ticket_id,
        uploader_id=user_id,
        filename=file.filename,
        filepath=object_name,          # object key de MinIO
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
    )
    db.add(attachment)
    db.flush()  # obtener attachment.id

    # 7. Crear evento en timeline
    timeline_event = TicketTimeline(
        ticket_id=ticket_id,
        author_id=user_id,
        event_type=TicketTimelineEventType.file,
        content=f"Adjuntó archivo: {file.filename}",
        meta_data={
            "attachment_id": attachment.id,
            "url": file_url,
            "type": file.content_type or "application/octet-stream",
            "size": len(content),
        },
    )
    db.add(timeline_event)
    db.commit()
    db.refresh(attachment, attribute_names=["uploader"])

    # 8. Responder
    return {
        "success": True,
        "attachment": {
            "id": attachment.id,
            "filename": attachment.filename,
            "filepath": attachment.filepath,
            "content_type": attachment.content_type,
            "size": attachment.size,
            "url": file_url,
            "uploader_name": _safe_name(attachment.uploader),
            "created_at": attachment.created_at.isoformat(),
        },
        "event": _timeline_to_response(timeline_event),
    }