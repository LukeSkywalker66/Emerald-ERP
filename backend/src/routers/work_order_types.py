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
    WorkOrderTypeCreate,
    WorkOrderTypeUpdate,
    WOTemplateCreate,
    WOTemplateUpdate,
    WOTemplateResponse,
    WOTemplateItemResponse,
    WOActionCreate,
    WOActionUpdate,
    WOActionResponse,
)
from src.models.work_order_types import WOAction

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


@router.put(
    "/{type_id}",
    response_model=WorkOrderTypeResponse,
)
def update_work_order_type(
    type_id: int,
    payload: "WorkOrderTypeUpdate",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar un tipo de OT (nombre, color, icono, etc). Solo admin."""
    require_admin(current_user)

    config = db.query(WorkOrderTypeConfig).filter(WorkOrderTypeConfig.id == type_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Tipo de OT no encontrado")

    if payload.name is not None:
        config.name = payload.name
    if payload.description is not None:
        config.description = payload.description
    if payload.color is not None:
        config.color = payload.color
    if payload.icon is not None:
        config.icon = payload.icon
    if payload.is_active is not None:
        config.is_active = payload.is_active

    db.commit()
    db.refresh(config)
    return config


@router.post(
    "/",
    response_model=WorkOrderTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "",
    response_model=WorkOrderTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_work_order_type(
    payload: "WorkOrderTypeCreate",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear un nuevo tipo de OT (solo admin)."""
    require_admin(current_user)

    existing = db.query(WorkOrderTypeConfig).filter(
        WorkOrderTypeConfig.code == payload.code
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe un tipo con code '{payload.code}'")

    config = WorkOrderTypeConfig(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        color=payload.color or "bg-zinc-600",
        icon=payload.icon,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.delete(
    "/{type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_work_order_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eliminar un tipo de OT (solo admin)."""
    require_admin(current_user)

    config = db.query(WorkOrderTypeConfig).filter(WorkOrderTypeConfig.id == type_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Tipo de OT no encontrado")

    db.delete(config)
    db.commit()


@router.patch(
    "/{type_id}/toggle",
    response_model=WorkOrderTypeResponse,
)
def toggle_work_order_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activar/desactivar un tipo de OT. Solo admin."""
    require_admin(current_user)

    config = db.query(WorkOrderTypeConfig).filter(WorkOrderTypeConfig.id == type_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Tipo de OT no encontrado")

    config.is_active = not config.is_active
    db.commit()
    db.refresh(config)
    return config


# ============================================================
# WO Templates CRUD (Admin only)
# ============================================================


def _build_template_response(template: WOTemplate) -> WOTemplateResponse:
    """Convierte un modelo WOTemplate a su schema de respuesta con items."""
    items = []
    for item in (template.items or []):
        product_name = item.product.name if item.product else None
        product_sku = item.product.sku if item.product else None
        group_name = item.group.name if item.group else None
        items.append(WOTemplateItemResponse(
            id=item.id,
            template_id=item.template_id,
            product_id=item.product_id,
            group_id=item.group_id,
            default_quantity=item.default_quantity,
            required=item.required,
            sort_order=item.sort_order,
            notes=item.notes,
            product_name=product_name,
            product_sku=product_sku,
            group_name=group_name,
        ))
    return WOTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        ot_type=template.ot_type,
        action_code=template.action_code,
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
    action_code: str = None,
    db: Session = Depends(get_db),
):
    """Listar plantillas de materiales. Filtro opcional por tipo de OT y acción."""
    stmt = select(WOTemplate).order_by(WOTemplate.name)
    if active_only:
        stmt = stmt.where(WOTemplate.is_active == True)
    if ot_type:
        stmt = stmt.where(WOTemplate.ot_type == ot_type)
    if action_code:
        stmt = stmt.where(WOTemplate.action_code == action_code)
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
        action_code=payload.action_code,
        is_active=payload.is_active,
    )
    db.add(template)
    db.flush()

    for idx, item_data in enumerate(payload.items):
        item = WOTemplateItem(
            template_id=template.id,
            product_id=item_data.product_id,
            group_id=item_data.group_id,
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
    if payload.action_code is not None:
        template.action_code = payload.action_code
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
                group_id=item_data.group_id,
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


# ============================================================
# WO Actions CRUD (Admin only)
# ============================================================


@router.get(
    "/actions",
    response_model=List[WOActionResponse],
)
def list_wo_actions(
    ot_type: str = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    """Listar acciones de resolución. Filtro opcional por tipo de OT."""
    stmt = select(WOAction).order_by(WOAction.ot_type, WOAction.sort_order)
    if ot_type:
        stmt = stmt.where(WOAction.ot_type == ot_type)
    if active_only:
        stmt = stmt.where(WOAction.is_active == True)
    result = db.execute(stmt).scalars().all()
    return result


@router.post(
    "/actions",
    response_model=WOActionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wo_action(
    payload: WOActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear una nueva acción de resolución (solo admin)."""
    require_admin(current_user)

    existing = db.query(WOAction).filter(
        WOAction.ot_type == payload.ot_type,
        WOAction.code == payload.code,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe una acción con code '{payload.code}' para este tipo de OT")

    action = WOAction(**payload.model_dump())
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


@router.put(
    "/actions/{action_id}",
    response_model=WOActionResponse,
)
def update_wo_action(
    action_id: int,
    payload: WOActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar una acción de resolución (solo admin)."""
    require_admin(current_user)

    action = db.query(WOAction).filter(WOAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Acción no encontrada")

    if payload.name is not None:
        action.name = payload.name
    if payload.description is not None:
        action.description = payload.description
    if payload.requires_notes is not None:
        action.requires_notes = payload.requires_notes
    if payload.is_active is not None:
        action.is_active = payload.is_active
    if payload.sort_order is not None:
        action.sort_order = payload.sort_order

    db.commit()
    db.refresh(action)
    return action


@router.delete(
    "/actions/{action_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_wo_action(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eliminar una acción de resolución (solo admin). Las built-in no se pueden eliminar."""
    require_admin(current_user)

    action = db.query(WOAction).filter(WOAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Acción no encontrada")
    if action.is_builtin:
        raise HTTPException(status_code=400, detail="No se puede eliminar una acción built-in")

    db.delete(action)
    db.commit()
