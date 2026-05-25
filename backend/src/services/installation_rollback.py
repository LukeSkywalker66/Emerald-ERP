"""
Servicio de rollback para tickets de instalación cancelados.

Cuando se cancela un ticket de instalación y ninguna OT alcanzó un estado
terminal (completed, failed), se limpian los registros sincronizados desde
ISPCube para permitir que un nuevo ticket use el mismo connection_id reciclado.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.models.beholder import Connection, Cliente, ClienteEmail, ClienteTelefono

# Estados terminales de OT: el técnico visitó el sitio (aunque no haya instalado)
TERMINAL_WO_STATUSES = {"completed", "failed"}


def has_executed_work_orders(ticket) -> bool:
    """
    Retorna True si alguna OT del ticket fue ejecutada (completed o failed).

    Si el técnico llegó a sitio, los datos sincronizados se conservan aunque
    la instalación no se haya completado (ej: cliente sin lugar en NAP).
    """
    return any(
        wo.status.value in TERMINAL_WO_STATUSES
        for wo in ticket.work_orders
    )


def rollback_installation_sync(db: Session, ticket) -> dict:
    """
    Elimina registros sincronizados durante la creación del ticket de instalación.

    Reglas:
    - Solo elimina la connection si ningún otro ticket activo la referencia.
    - Solo elimina el cliente si ninguna otra conexión ni ticket lo referencia.

    Args:
        db: Sesión de base de datos activa
        ticket: Instancia del ticket a rollbackear

    Returns:
        dict con detalle de lo eliminado (para timeline event)
    """
    details = {
        "connection_deleted": False,
        "cliente_deleted": False,
        "work_orders_cancelled": 0,
    }

    conn_details = ticket.connection_details or {}
    customer_id = conn_details.get("_sync_customer_id")
    conn_id_str = conn_details.get("_sync_connection_id")

    # --- Eliminar conexión sincronizada ---
    if conn_id_str:
        conn_id = int(conn_id_str)
        other_ticket_using_conn = db.execute(
            text(
                "SELECT 1 FROM tickets WHERE id != :tid AND "
                "(connection_id = :cid OR destination_connection_id = :cid) "
                "AND status NOT IN ('closed', 'cancelled')"
            ),
            {"tid": ticket.id, "cid": conn_id},
        ).first()

        if not other_ticket_using_conn:
            deleted = db.query(Connection).filter_by(connection_id=conn_id).delete()
            details["connection_deleted"] = deleted > 0

    # --- Eliminar cliente solo si queda huérfano ---
    if customer_id:
        other_ticket_with_customer = db.execute(
            text(
                "SELECT 1 FROM tickets WHERE id != :tid AND "
                "connection_details->>'_sync_customer_id' = :cid "
                "AND status NOT IN ('closed', 'cancelled')"
            ),
            {"tid": ticket.id, "cid": str(customer_id)},
        ).first()

        other_conn_with_customer = db.query(Connection).filter(
            Connection.customer_id == customer_id
        ).first()

        if not other_ticket_with_customer and not other_conn_with_customer:
            db.query(ClienteEmail).filter_by(customer_id=customer_id).delete()
            db.query(ClienteTelefono).filter_by(customer_id=customer_id).delete()
            deleted = db.query(Cliente).filter_by(id=customer_id).delete()
            details["cliente_deleted"] = deleted > 0

    # --- Cancelar OTs pendientes (marcar como failed) ---
    from src.models.tickets import WorkOrderStatus

    for wo in ticket.work_orders:
        if wo.status.value not in TERMINAL_WO_STATUSES:
            wo.status = WorkOrderStatus.failed
            details["work_orders_cancelled"] += 1

    return details
