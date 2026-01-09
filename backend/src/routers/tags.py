"""Router para gestionar Etiquetas (Tags) de Tickets.

Endpoints:
  GET    /api/v2/tags               - Listar todas las etiquetas
  POST   /api/v2/tags               - Crear nueva etiqueta
  POST   /api/v2/tickets/{id}/tags/{tag_id}  - Asignar etiqueta a ticket
  DELETE /api/v2/tickets/{id}/tags/{tag_id}  - Remover etiqueta de ticket
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.tickets import Tag, Ticket
from src.schemas.tickets import TagResponse, TagCreate

router = APIRouter()


def get_user_id(request: Request) -> int:
    """Helper para obtener user_id del request state."""
    return getattr(request.state, "user_id", 2)  # Default admin


# ============================================
# ENDPOINTS DE TAGS
# ============================================

@router.get(
    "/tags",
    response_model=List[TagResponse],
    tags=["Tags"]
)
@router.get(
    "/tags/",
    response_model=List[TagResponse],
    tags=["Tags"]
)
def list_tags(
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """
    Listar todas las etiquetas disponibles.
    
    **Query Params:**
    - `active_only` (bool): Si es True, solo retorna etiquetas activas (default: True)
    
    **Respuesta:** Lista de TagResponse ordenada por nombre
    """
    query = select(Tag)
    
    if active_only:
        query = query.where(Tag.is_active == True)
    
    query = query.order_by(Tag.name.asc())
    
    result = db.execute(query)
    tags = result.scalars().all()
    
    return [TagResponse.model_validate(tag) for tag in tags]


@router.post(
    "/tags",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Tags"]
)
@router.post(
    "/tags/",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Tags"]
)
def create_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """
    Crear una nueva etiqueta.
    
    **Body:**
    - `name` (str): Nombre único (ej: "Fibra Cortada")
    - `color` (str): Color en Hex o nombre Tailwind (ej: "#ef4444" o "red")
    - `is_active` (bool): Activar/desactivar (default: True)
    
    **Error:** 409 si el nombre ya existe
    """
    # Verificar que no exista etiqueta con el mismo nombre
    existing = db.execute(
        select(Tag).where(Tag.name.ilike(payload.name))
    ).scalars().first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La etiqueta '{payload.name}' ya existe"
        )
    
    tag = Tag(
        name=payload.name.strip(),
        color=payload.color.strip(),
        is_active=payload.is_active,
    )
    
    db.add(tag)
    db.commit()
    db.refresh(tag)
    
    return TagResponse.model_validate(tag)


# ============================================
# ENDPOINTS DE ASIGNACIÓN: TICKET <-> TAG
# ============================================

@router.post(
    "/tickets/{ticket_id}/tags/{tag_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    tags=["Tickets", "Tags"]
)
@router.post(
    "/tickets/{ticket_id}/tags/{tag_id}/",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    tags=["Tickets", "Tags"]
)
def assign_tag_to_ticket(
    ticket_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """
    Asignar una etiqueta a un ticket.
    
    **Path Params:**
    - `ticket_id` (int): ID del ticket
    - `tag_id` (int): ID de la etiqueta
    
    **Respuesta:** { "success": true, "tags": [...] }
    
    **Errores:**
    - 404 si ticket o tag no existen
    - 400 si la etiqueta ya está asignada al ticket
    """
    # Validar ticket
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket no encontrado"
        )
    
    # Validar tag
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etiqueta no encontrada"
        )
    
    # Verificar que no esté ya asignada
    if tag in ticket.tags:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La etiqueta '{tag.name}' ya está asignada a este ticket"
        )
    
    # Asignar
    ticket.tags.append(tag)
    db.commit()
    db.refresh(ticket, attribute_names=["tags"])
    
    return {
        "success": True,
        "tags": [TagResponse.model_validate(t) for t in ticket.tags],
    }


@router.delete(
    "/tickets/{ticket_id}/tags/{tag_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    tags=["Tickets", "Tags"]
)
@router.delete(
    "/tickets/{ticket_id}/tags/{tag_id}/",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    tags=["Tickets", "Tags"]
)
def remove_tag_from_ticket(
    ticket_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """
    Remover una etiqueta de un ticket.
    
    **Path Params:**
    - `ticket_id` (int): ID del ticket
    - `tag_id` (int): ID de la etiqueta
    
    **Respuesta:** { "success": true, "tags": [...] }
    
    **Errores:**
    - 404 si ticket o tag no existen
    - 400 si la etiqueta no está asignada al ticket
    """
    # Validar ticket
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket no encontrado"
        )
    
    # Validar tag
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etiqueta no encontrada"
        )
    
    # Verificar que esté asignada
    if tag not in ticket.tags:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La etiqueta '{tag.name}' no está asignada a este ticket"
        )
    
    # Remover
    ticket.tags.remove(tag)
    db.commit()
    db.refresh(ticket, attribute_names=["tags"])
    
    return {
        "success": True,
        "tags": [TagResponse.model_validate(t) for t in ticket.tags],
    }
