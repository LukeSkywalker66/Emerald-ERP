"""Router para cuentas de TV (usuarios PPPoE de IPTV)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.installation import TvAccount

router = APIRouter(tags=["tv-accounts"])


class TvAccountResponse(BaseModel):
    id: int
    username: str
    password: str
    connection_id: Optional[int] = None
    status: str
    assigned_at: Optional[datetime] = None
    released_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TvAccountAssignRequest(BaseModel):
    connection_id: int = Field(..., description="Conexión a la que se asigna la cuenta")


@router.get("", response_model=list[TvAccountResponse])
def list_tv_accounts(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    """Listar cuentas de TV (opcional filtrar por status: available | assigned)."""
    query = db.query(TvAccount)
    if status_filter:
        query = query.filter(TvAccount.status == status_filter)
    return query.order_by(TvAccount.username.asc()).all()


@router.get("/next-available", response_model=TvAccountResponse)
def next_available_tv_account(db: Session = Depends(get_db)):
    """Proponer la próxima cuenta de TV disponible (menor número libre)."""
    account = (
        db.query(TvAccount)
        .filter(TvAccount.status == "available", TvAccount.connection_id.is_(None))
        .order_by(TvAccount.username.asc())
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="No hay cuentas de TV disponibles")
    return account


@router.post("/{account_id}/assign", response_model=TvAccountResponse)
def assign_tv_account(
    account_id: int,
    payload: TvAccountAssignRequest,
    db: Session = Depends(get_db),
):
    """Asignar una cuenta de TV a una conexión."""
    account = db.get(TvAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta de TV no encontrada")
    if account.status == "assigned":
        raise HTTPException(
            status_code=409,
            detail=f"La cuenta {account.username} ya está asignada",
        )

    account.connection_id = payload.connection_id
    account.status = "assigned"
    account.assigned_at = datetime.utcnow()
    account.released_at = None
    db.commit()
    db.refresh(account)
    return account


@router.post("/{account_id}/release", response_model=TvAccountResponse)
def release_tv_account(account_id: int, db: Session = Depends(get_db)):
    """Liberar una cuenta de TV (reutilizable)."""
    account = db.get(TvAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta de TV no encontrada")

    account.connection_id = None
    account.status = "available"
    account.released_at = datetime.utcnow()
    db.commit()
    db.refresh(account)
    return account
