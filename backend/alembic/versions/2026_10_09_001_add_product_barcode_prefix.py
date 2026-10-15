"""add products.barcode_prefix

Revision ID: 2026_10_09_001
Revises: 2026_10_07_006
Create Date: 2026-10-09 00:00:00.000000

Agrega `products.barcode_prefix` para controlar el prefijo de los códigos de
barras propios generados por Emerald (antes derivado por keywords con fallback
`TRK` fijo). Se backfillea con una derivación coherente por grupo/nombre/SKU.

Los códigos ya emitidos no se renombran: el prefijo aplica solo a códigos
nuevos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_09_001'
down_revision: Union[str, Sequence[str], None] = '2026_10_07_006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "barcode_prefix",
            sa.String(4),
            nullable=True,
            comment="Prefijo de 1-4 caracteres para códigos de barras propios",
        ),
    )

    # Backfill: derivar prefijo coherente para productos existentes según
    # grupo/nombre. Los que no matchean quedan NULL y se derivan del SKU en
    # runtime (misma lógica que _infer_prefix).
    op.execute(
        """
        WITH pg AS (SELECT id, name FROM product_groups)
        UPDATE products
        SET barcode_prefix = CASE
            WHEN UPPER(COALESCE((SELECT pg.name FROM pg WHERE pg.id = products.group_id), '')) LIKE '%ONT%'
              OR UPPER(COALESCE((SELECT pg.name FROM pg WHERE pg.id = products.group_id), '')) LIKE '%ONU%'
              OR UPPER(name) LIKE '%ONT%'
              OR UPPER(name) LIKE '%ONU%' THEN 'ONT'
            WHEN UPPER(name) LIKE '%ROUTER%' THEN 'RTR'
            WHEN UPPER(name) LIKE '%DROP%' THEN 'DRP'
            WHEN UPPER(name) LIKE '%FIBRA%' OR UPPER(name) LIKE '%FIBER%' THEN 'FBR'
            WHEN UPPER(name) LIKE '%CABLE%' THEN 'CBL'
            WHEN UPPER(name) LIKE '%CONECTOR%' THEN 'CNT'
            ELSE barcode_prefix
        END
        WHERE barcode_prefix IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("products", "barcode_prefix")
