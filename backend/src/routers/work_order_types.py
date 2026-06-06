"""Router for WorkOrderType configuration and WO Templates CRUD."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.security import get_current_user, require_admin
from src.models.user import User
from src.models.work_order_types import WorkOrderTypeConfig, WOTemplate, WOTemplateItem
from src.models.inventory import Product
from src.schemas.work_order_types import (
    WorkOrderTypeResponse,
    WOTemplateCreate,
    WOTemplateUpdate,
    WOTemplateResponse,
    WOTemplateItemResponse,
)

router = APIRouter(tags=["WorkOrderTypes"])


@router.get(
    "",
    response_model=List[WorkOrderTypeResponse],
)
@router.get(
    "/",
    response_model=List[WorkOrderTypeResponse],
)
def list_work_order_types(
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """
    Devuelve los tipos de orden de trabajo disponibles.

    Args:
        active_only: Si true, solo devuelve tipos activos (default: true)

    Returns:
        Lista de tipos de OT con código, nombre, color, icono, etc.
    """
    stmt = select(WorkOrderTypeConfig).order_by(WorkOrderTypeConfig.code)

    if active_only:
        stmt = stmt.where(WorkOrderTypeConfig.is_active == True)

    result = db.execute(stmt).scalars().all()
    return result


# ============================================================
# WO Templates CRUD (Admin only)
# ============================================================


def _build_template_response(template: WOTemplate) -> WOTemplateResponse:
    """Convierte un modelo WOTemplate a su schema de respuesta con items."""
    items = []
    for item in (template.items or []):
        product_name = item.product.name if item.product else None
        product_sku = item.product.sku if item.product else None
        items.append(WOTemplateItemResponse(
            id=item.id,
            template_id=item.template_id,
            product_id=item.product_id,
            default_quantity=item.default_quantity,
            required=item.required,
            sort_order=item.sort_order,
            notes=item.notes,
            product_name=product_name,
            product_sku=product_sku,
        ))
    return WOTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        ot_type=template.ot_type,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
        items=items,
    )


@router.get(
    "/templates",
    response_model=List[WOTemplateResponse],
)
def list_wo_templates(
    active_only: bool = False,
    ot_type: str = None,
    db: Session = Depends(get_db),
):
    """Listar plantillas de materiales. Filtro opcional por tipo de OT."""
    stmt = select(WOTemplate).order_by(WOTemplate.name)
    if active_only:
        stmt = stmt.where(WOTemplate.is_active == True)
    if ot_type:
        stmt = stmt.where(WOTemplate.ot_type == ot_type)
    result = db.execute(stmt).scalars().all()
    return [_build_template_response(t) for t in result]


@router.get(
    "/templates/{template_id}",
    response_model=WOTemplateResponse,
)
def get_wo_template(
    template_id: int,
    db: Session = Depends(get_db),
):
    """Obtener una plantilla por ID."""
    template = db.query(WOTemplate).filter(WOTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return _build_template_response(template)


@router.post(
    "/templates",
    response_model=WOTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wo_template(
    payload: WOTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear una nueva plantilla (solo admin)."""
    require_admin(current_user)

    template = WOTemplate(
        name=payload.name,
        description=payload.description,
        ot_type=payload.ot_type,
        is_active=payload.is_active,
    )
    db.add(template)
    db.flush()

    for idx, item_data in enumerate(payload.items):
        item = WOTemplateItem(
            template_id=template.id,
            product_id=item_data.product_id,
            default_quantity=item_data.default_quantity,
            required=item_data.required,
            sort_order=item_data.sort_order or idx,
            notes=item_data.notes,
        )
        db.add(item)

    db.commit()
    db.refresh(template)
    return _build_template_response(template)


@router.put(
    "/templates/{template_id}",
    response_model=WOTemplateResponse,
)
def update_wo_template(
    template_id: int,
    payload: WOTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar una plantilla (solo admin). Reemplaza items si se envían."""
    require_admin(current_user)

    template = db.query(WOTemplate).filter(WOTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    if payload.name is not None:
        template.name = payload.name
    if payload.description is not None:
        template.description = payload.description
    if payload.ot_type is not None:
        template.ot_type = payload.ot_type
    if payload.is_active is not None:
        template.is_active = payload.is_active

    # Reemplazar items si se envían
    if payload.items is not None:
        # Eliminar items existentes
        db.query(WOTemplateItem).filter(
            WOTemplateItem.template_id == template_id
        ).delete()
        # Crear nuevos items
        for idx, item_data in enumerate(payload.items):
            item = WOTemplateItem(
                template_id=template.id,
                product_id=item_data.product_id,
                default_quantity=item_data.default_quantity,
                required=item_data.required,
                sort_order=item_data.sort_order or idx,
                notes=item_data.notes,
            )
            db.add(item)

    db.commit()
    db.refresh(template)
    return _build_template_response(template)


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_wo_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eliminar una plantilla (solo admin)."""
    require_admin(current_user)

    template = db.query(WOTemplate).filter(WOTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    db.delete(template)
    db.commit()
