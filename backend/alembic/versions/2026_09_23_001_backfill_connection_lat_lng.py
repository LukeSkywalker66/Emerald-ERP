"""backfill connection lat/lng from work_orders

Revision ID: 2026_09_23_001
Revises: 2026_06_26_003_rclone_cfg
Create Date: 2026-09-23 00:01:00.000000

La ubicación canónica de un servicio vive en `connections.latitude/longitude`.
Históricamente se venía guardando solo en `work_orders.latitude/longitude`, por lo
que este backfill vuelca las coordenadas de las OTs existentes hacia su conexión,
SOLO donde la conexión está vacía y la OT tiene dato.

Reglas:
- No pisa coordenadas ya existentes en la conexión.
- No escribe valores vacíos (solo OTs con lat y lng no nulos).
- Las OTs de infraestructura (ticket sin conexión) no se vuelcan a ninguna conexión.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_09_23_001'
down_revision: Union[str, Sequence[str], None] = '2026_06_26_003_rclone_cfg'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE connections c
            SET latitude = w.latitude,
                longitude = w.longitude
            FROM (
                SELECT DISTINCT ON (
                           COALESCE(t.connection_id, t.destination_connection_id, t.origin_connection_id)
                       )
                       COALESCE(t.connection_id, t.destination_connection_id, t.origin_connection_id) AS conn_id,
                       w.latitude,
                       w.longitude
                FROM work_orders w
                JOIN tickets t ON t.id = w.ticket_id
                WHERE w.latitude IS NOT NULL
                  AND w.longitude IS NOT NULL
                  AND COALESCE(t.connection_id, t.destination_connection_id, t.origin_connection_id) IS NOT NULL
                ORDER BY COALESCE(t.connection_id, t.destination_connection_id, t.origin_connection_id),
                         w.created_at DESC NULLS LAST
            ) w
            WHERE w.conn_id = c.connection_id
              AND c.latitude IS NULL
              AND c.longitude IS NULL
            """
        )
    )


def downgrade() -> None:
    # No-op intencional: no se revierte el backfill para no perder datos.
    pass
