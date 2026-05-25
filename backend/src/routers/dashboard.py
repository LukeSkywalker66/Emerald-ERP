"""Dashboard Router — Endpoints de métricas agregadas para el tablero operativo.

Provee un endpoint único `/summary` que agrega datos de tickets, clientes,
nodos, ONUs, work orders y estado de sincronización en una sola respuesta.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.security import get_current_user
from src.models.user import User
from src.services.dashboard_service import DashboardService

logger = logging.getLogger("uvicorn.error")

router = APIRouter(tags=["Dashboard"])


@router.get("/summary", response_model=Dict[str, Any])
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener métricas agregadas del tablero operativo.

    **Autenticación requerida:** JWT Token válido

    **Response:**
    - `tickets`: Conteo de tickets activos, abiertos, en progreso, pendientes, creados hoy
    - `clientes`: Total de conexiones y clientes en BD
    - `nodos`: Total de nodos (OLTs)
    - `onus`: Total de subscribers y aquellos con PPPoE asignado
    - `work_orders`: Conteo de work orders pendientes, en curso, completadas hoy
    - `sync`: Última ejecución de sync por fuente (SmartOLT, ISPCube, etc.)
    """
    try:
        summary = DashboardService.get_summary(db)
        return summary
    except Exception as e:
        logger.error(f"Error al obtener resumen del dashboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener resumen del dashboard",
        )
