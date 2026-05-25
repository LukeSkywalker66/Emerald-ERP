"""Dashboard Service — Agregación de métricas para el tablero operativo.

Obtiene conteos en tiempo real desde múltiples tablas usando COUNT queries
livianas (sin carga de filas), y resume el estado de sincronización.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import func, select, desc
from sqlalchemy.orm import Session

from src.models.beholder import Subscriber, Node, Connection, Cliente, SyncStatus
from src.models.tickets import Ticket, TicketStatus, WorkOrder, WorkOrderStatus

logger = logging.getLogger("uvicorn.error")


class DashboardService:
    """Servicio estático que agrega métricas del dashboard."""

    @staticmethod
    def get_summary(db: Session) -> Dict[str, Any]:
        """Retorna un dict con todas las métricas agregadas del dashboard.

        Realiza únicamente COUNT queries (sin fetch de filas) para mantener
        el endpoint liviano incluso con miles de registros.
        """
        # ── Tickets ─────────────────────────────────────────────────
        total_activos = db.execute(
            select(func.count(Ticket.id)).where(
                Ticket.status.notin_([TicketStatus.closed, TicketStatus.cancelled])
            )
        ).scalar() or 0

        abiertos = db.execute(
            select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.open)
        ).scalar() or 0

        en_progreso = db.execute(
            select(func.count(Ticket.id)).where(
                Ticket.status == TicketStatus.in_progress
            )
        ).scalar() or 0

        pendientes = db.execute(
            select(func.count(Ticket.id)).where(
                Ticket.status == TicketStatus.pending
            )
        ).scalar() or 0

        # Creados hoy (desde medianoche en UTC-3)
        today_start = datetime.now(timezone.utc).replace(
            hour=3, minute=0, second=0, microsecond=0
        )
        creados_hoy = db.execute(
            select(func.count(Ticket.id)).where(Ticket.created_at >= today_start)
        ).scalar() or 0

        # ── Clientes / Conexiones ──────────────────────────────────
        total_conexiones = db.execute(
            select(func.count(Connection.connection_id))
        ).scalar() or 0

        total_clientes = db.execute(
            select(func.count(Cliente.id))
        ).scalar() or 0

        # ── Nodos ──────────────────────────────────────────────────
        total_nodos = db.execute(
            select(func.count(Node.node_id))
        ).scalar() or 0

        # ── ONUs / Subscribers ─────────────────────────────────────
        total_subscribers = db.execute(
            select(func.count(Subscriber.id))
        ).scalar() or 0

        # Subscribers con pppoe_username no nulo ≈ ONUs conectadas/activas
        subscribers_con_pppoe = db.execute(
            select(func.count(Subscriber.id)).where(
                Subscriber.pppoe_username.isnot(None),
                Subscriber.pppoe_username != "",
            )
        ).scalar() or 0

        # ── Work Orders ────────────────────────────────────────────
        wo_pendientes = db.execute(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.status == WorkOrderStatus.pending_planning
            )
        ).scalar() or 0

        wo_en_curso = db.execute(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.status == WorkOrderStatus.in_progress
            )
        ).scalar() or 0

        wo_completadas_hoy = db.execute(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.status == WorkOrderStatus.completed,
                WorkOrder.completed_at >= today_start,
            )
        ).scalar() or 0

        # ── Sync Status (última ejecución por fuente) ─────────────
        sync_sources: list[Dict[str, Any]] = []
        try:
            fuentes = db.execute(
                select(SyncStatus.fuente).distinct()
            ).scalars().all()

            for fuente in fuentes:
                ultimo = db.execute(
                    select(SyncStatus)
                    .where(SyncStatus.fuente == fuente)
                    .order_by(desc(SyncStatus.ultima_actualizacion))
                    .limit(1)
                ).scalar_one_or_none()

                if ultimo:
                    sync_sources.append({
                        "fuente": fuente,
                        "estado": "ok" if ultimo.estado == "ok" else "error",
                        "ultima_sync": (
                            ultimo.ultima_actualizacion.isoformat()
                            if ultimo.ultima_actualizacion
                            else None
                        ),
                        "detalle": ultimo.detalle,
                    })
        except Exception as e:
            logger.warning(f"No se pudo obtener sync_status: {e}")

        return {
            "tickets": {
                "total_activos": total_activos,
                "abiertos": abiertos,
                "en_progreso": en_progreso,
                "pendientes": pendientes,
                "creados_hoy": creados_hoy,
            },
            "clientes": {
                "total_conexiones": total_conexiones,
                "total_clientes": total_clientes,
            },
            "nodos": {
                "total": total_nodos,
            },
            "onus": {
                "total": total_subscribers,
                "con_pppoe": subscribers_con_pppoe,
            },
            "work_orders": {
                "pendientes": wo_pendientes,
                "en_curso": wo_en_curso,
                "completadas_hoy": wo_completadas_hoy,
            },
            "sync": {
                "por_fuente": sync_sources,
            },
        }
