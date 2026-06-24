"""Convert composite stock and alert thresholds to composite units

Revision ID: 2026_06_17_001
Revises: 2026_06_10_002
Create Date: 2026-06-17 00:00:00.000000

Este día cero reexpresa el stock de productos compuestos en unidades
compuestas (bobinas, blisters, cajas) en lugar de metros/unidades base.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2026_06_17_001"
down_revision: Union[str, None] = "2026_06_10_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade: reescalar datos existentes a unidades compuestas."""

    # 1) `min_stock_alert` debe poder guardar fracciones de bobina/blister.
    # Se pasa a DOUBLE PRECISION antes de actualizar los datos.
    op.alter_column(
        "products",
        "min_stock_alert",
        existing_type=sa.Integer(),
        type_=sa.Float(),
        existing_nullable=False,
        postgresql_using="min_stock_alert::double precision",
    )

    # 2) Reescalar stock_bulk.quantity para productos compuestos.
    #    Antes: quantity = metros / unidades base
    #    Ahora:  quantity = bobinas / blisters / unidades compuestas
    op.execute(
        """
        UPDATE stock_bulk sb
        SET quantity = sb.quantity / p.unit_size
        FROM products p
        WHERE sb.product_id = p.id
          AND p.is_composite = true
          AND p.unit_size IS NOT NULL
          AND p.unit_size > 0
        """
    )

    # 3) Reescalar min_stock_alert con la misma semántica.
    #    Si un producto compuesto alertaba a 150m y su unit_size es 300,
    #    la nueva alerta pasa a 0.5 bobinas.
    op.execute(
        """
        UPDATE products p
        SET min_stock_alert = p.min_stock_alert / p.unit_size
        WHERE p.is_composite = true
          AND p.unit_size IS NOT NULL
          AND p.unit_size > 0
        """
    )


def downgrade() -> None:
    """Downgrade: revertir a la semántica anterior en metros/unidades base."""

    # 1) Volver stock_bulk.quantity a metros/unidades base para compuestos.
    op.execute(
        """
        UPDATE stock_bulk sb
        SET quantity = sb.quantity * p.unit_size
        FROM products p
        WHERE sb.product_id = p.id
          AND p.is_composite = true
          AND p.unit_size IS NOT NULL
          AND p.unit_size > 0
        """
    )

    # 2) Volver min_stock_alert a su escala anterior (metros/unidades base).
    #    Se usa ROUND para recuperar el entero más cercano antes de castear.
    op.execute(
        """
        UPDATE products p
        SET min_stock_alert = ROUND(p.min_stock_alert * p.unit_size)
        WHERE p.is_composite = true
          AND p.unit_size IS NOT NULL
          AND p.unit_size > 0
        """
    )

    # 3) Revertir el tipo de columna a INTEGER.
    op.alter_column(
        "products",
        "min_stock_alert",
        existing_type=sa.Float(),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="ROUND(min_stock_alert)::integer",
    )
