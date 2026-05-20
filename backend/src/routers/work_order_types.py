"""Router for WorkOrderType configuration endpoints."""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.work_order_types import WorkOrderTypeConfig
from src.schemas.work_order_types import WorkOrderTypeResponse

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
