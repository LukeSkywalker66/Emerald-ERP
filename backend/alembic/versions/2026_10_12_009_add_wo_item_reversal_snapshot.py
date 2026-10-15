"""add reversal snapshot columns to work_order_items

Revision ID: 2026_10_12_009
Revises: 2026_10_12_008
Create Date: 2026-10-12 00:00:00.000000

Para que la bitácora pueda QUITAR / CORREGIR CANTIDAD / REEMPLAZAR materiales de
forma real (reversa exacta del consumo), cada item guarda el estado previo al
cierre:
- previous_serial_status: estado del SerialItem antes de INSTALLED.
- previous_warehouse_id: warehouse real del serial antes de moverlo a VIRTUAL.
- previous_remaining_quantity: saldo de la unidad trazable antes de consumir.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_12_009'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('work_order_items', sa.Column('previous_serial_status', sa.String(50), nullable=True))
    op.add_column('work_order_items', sa.Column('previous_warehouse_id', sa.Integer(), nullable=True))
    op.add_column('work_order_items', sa.Column('previous_remaining_quantity', sa.Float(), nullable=True))
    # FK declarada en el modelo WorkOrderItem.previous_warehouse_id (misma semántica
    # que warehouse_id: referencia a warehouses.id con SET NULL al borrar depósito).
    op.create_foreign_key(
        "fk_work_order_items_previous_warehouse_id",
        "work_order_items",
        "warehouses",
        ["previous_warehouse_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_work_order_items_previous_warehouse_id",
        "work_order_items",
        type_="foreignkey",
    )
    op.drop_column('work_order_items', 'previous_remaining_quantity')
    op.drop_column('work_order_items', 'previous_warehouse_id')
    op.drop_column('work_order_items', 'previous_serial_status')
