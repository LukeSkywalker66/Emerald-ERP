"""seed default WO actions for ot_type 'install'

Revision ID: 2026_10_12_008
Revises: 2026_10_12_007
Create Date: 2026-10-12 00:00:00.000000

El tipo neutro 'install' (TV, mesh y otros sobre conexión existente) no tenía
acciones de resolución en wo_actions. Se siembran las acciones builtin
'Realizada' y 'No Realizada' para que el wizard de cierre muestre las etiquetas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_12_008'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    actions = [
        {"ot_type": "install", "code": "realizada", "name": "Realizada", "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
        {"ot_type": "install", "code": "no_realizada", "name": "No Realizada", "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
        {"ot_type": "install", "code": "configurar_tv", "name": "Configurar TV", "description": "Instalar app y configurar usuario de TV", "requires_notes": False, "sort_order": 1, "is_builtin": False},
    ]
    for a in actions:
        conn.execute(
            sa.text(
                """
                INSERT INTO wo_actions (ot_type, code, name, description, requires_notes, sort_order, is_builtin)
                VALUES (:ot_type, :code, :name, :description, :requires_notes, :sort_order, :is_builtin)
                ON CONFLICT (ot_type, code) DO NOTHING
                """
            ),
            a,
        )


def downgrade() -> None:
    op.execute("DELETE FROM wo_actions WHERE ot_type = 'install' AND code IN ('realizada', 'no_realizada', 'configurar_tv')")
