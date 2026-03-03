"""Router para búsqueda global."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Table, MetaData, or_, select, text
from sqlalchemy.orm import Session

from src.database import get_db
from src.services import ispcube as ispcube_service
from src.models import User  # Para obtener usuarios

router = APIRouter()


class ConnectionSearchResult(BaseModel):
    """Resultado de búsqueda de conexiones."""
    connection_id: int
    client_name: str
    client_dni: Optional[str] = None
    pppoe_username: Optional[str] = None
    installation_address: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class UserSimpleResponse(BaseModel):
    """Usuario simple para asignación."""
    id: int
    name: str
    
    model_config = ConfigDict(from_attributes=True)


@router.get("/v2/search", response_model=List[ConnectionSearchResult])
def search_connections(
    q: str = Query(..., min_length=2, description="Término de búsqueda"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Búsqueda de conexiones/clientes por:
    - Nombre del cliente
    - DNI
    - Usuario PPPoE
    - Dirección de instalación
    """
    search_term = f"%{q}%"
    
    # JOIN con tabla clientes para obtener datos del cliente
    query = text("""
        SELECT 
            c.connection_id,
            cl.name as client_name,
            cl.doc_number as client_dni,
            c.pppoe_username,
            COALESCE(c.direccion, cl.address) as installation_address
        FROM connections c
        LEFT JOIN clientes cl ON c.customer_id = cl.id
        WHERE 
            cl.name ILIKE :search
            OR cl.doc_number ILIKE :search
            OR c.pppoe_username ILIKE :search
            OR c.direccion ILIKE :search
            OR cl.address ILIKE :search
        LIMIT :limit
    """)
    
    result = db.execute(query, {"search": search_term, "limit": limit})
    connections = result.fetchall()
    
    return [
        ConnectionSearchResult(
            connection_id=row.connection_id,
            client_name=row.client_name or "Cliente sin nombre",
            client_dni=row.client_dni,
            pppoe_username=row.pppoe_username,
            installation_address=row.installation_address,
        )
        for row in connections
    ]


@router.get("/external/customer-lookup")
def external_customer_lookup(
    dni: str = Query(..., min_length=3, description="DNI del cliente en ISPCube"),
):
    """Consulta read-only al API de ISPCube para obtener un cliente y sus conexiones."""
    data = ispcube_service.get_customer_by_dni(dni)

    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado en ISPCube",
        )

    customer = data.get("customer", {})
    connections = data.get("connections") or []

    return {
        "customer": {
            **customer,
            "external_id": customer.get("id"),
        },
        "connections": [
            {
                **conn,
                "external_id": conn.get("id"),
                "pppoe_username": conn.get("user"),
                "address": conn.get("address") or conn.get("direccion"),
                "plan_id": conn.get("plan_id"),
                "node_id": conn.get("node_id"),
                "status": conn.get("status") or conn.get("state") or "unknown",
            }
            for conn in connections
        ],
    }


@router.get("/v2/users", response_model=List[UserSimpleResponse])
def list_users(
    db: Session = Depends(get_db),
):
    """Listar todos los usuarios activos (para asignación de tickets)."""
    stmt = select(User).where(User.is_active == True).order_by(User.full_name)
    users = db.execute(stmt).scalars().all()
    
    return [
        UserSimpleResponse(
            id=user.id,
            name=user.full_name or user.username,
        )
        for user in users
    ]

