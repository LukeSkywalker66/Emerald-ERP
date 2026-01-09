"""Helper para construir snapshots de conexión."""
from datetime import datetime
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session


def build_connection_snapshot(db: Session, connection_id: Optional[int]) -> Optional[dict]:
    """Construye un snapshot completo de conexión-cliente-nodo-plan desde DB."""
    if not connection_id:
        return None
    
    try:
        row = db.execute(
            text(
                """
                SELECT 
                    c.connection_id,
                    c.pppoe_username,
                    COALESCE(c.direccion, cl.address) AS address,
                    cl.id AS client_id,
                    cl.name AS client_name,
                    cl.doc_number AS client_dni,
                    n.node_id AS node_id,
                    n.name AS node_name,
                    n.ip_address AS node_ip,
                    p.plan_id AS plan_id,
                    p.name AS plan_name,
                    p.speed AS plan_speed
                FROM connections c
                LEFT JOIN clientes cl ON c.customer_id = cl.id
                LEFT JOIN nodes n ON c.node_id = n.node_id
                LEFT JOIN plans p ON c.plan_id = p.plan_id
                WHERE c.connection_id = :conn_id
                LIMIT 1
                """
            ),
            {"conn_id": connection_id},
        ).first()
        
        if not row:
            return None
        
        return {
            "connection_id": row[0],
            "pppoe_username": row[1],
            "address": row[2],
            "client_id": row[3],
            "client_name": row[4],
            "client_dni": row[5],
            "node_id": row[6],
            "node_name": row[7],
            "node_ip": row[8],
            "plan_id": row[9],
            "plan_name": row[10],
            "plan_speed": row[11],
            "snapshot_at": datetime.utcnow().isoformat(),
        }
    except Exception:
        return None
