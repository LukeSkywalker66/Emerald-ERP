"""add_wo_actions

Revision ID: 2026_06_07_003
Revises: 2026_06_07_002
Create Date: 2026-06-07 11:30:00.000000

Agrega tabla wo_actions para acciones de resolución configurables por tipo de OT.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_07_003'
down_revision: Union[str, Sequence[str], None] = '2026_06_07_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Acciones semilla por tipo de OT
SEED_ACTIONS = [
    {"ot_type": "install_ftth", "code": "realizada", "name": "Realizada", "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
    {"ot_type": "install_ftth", "code": "no_realizada", "name": "No Realizada", "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
    {"ot_type": "install_aire", "code": "realizada", "name": "Realizada", "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
    {"ot_type": "install_aire", "code": "no_realizada", "name": "No Realizada", "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
    {"ot_type": "pickup", "code": "realizada", "name": "Realizada", "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
    {"ot_type": "pickup", "code": "no_realizada", "name": "No Realizada", "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
    {"ot_type": "repair", "code": "reconfiguracion", "name": "Reconfiguración", "description": "Reconfigurar equipo reseteado o cambiar clave WiFi", "requires_notes": False, "sort_order": 0, "is_builtin": False},
    {"ot_type": "repair", "code": "reemplazo_equipo", "name": "Reemplazo de equipo", "description": "Cambiar ONU, router u otro equipo", "requires_notes": False, "sort_order": 1, "is_builtin": False},
    {"ot_type": "repair", "code": "reemplazo_cable", "name": "Reemplazo de cable", "description": "Cambiar drop, UTP u otro cableado", "requires_notes": False, "sort_order": 2, "is_builtin": False},
    {"ot_type": "repair", "code": "reemplazo_conectores", "name": "Reemplazo de conectores", "description": "Cambiar conectores verdes, RJ45, etc.", "requires_notes": False, "sort_order": 3, "is_builtin": False},
    {"ot_type": "repair", "code": "agregar_mesh", "name": "Agregar Mesh", "description": "Instalar equipo mesh adicional", "requires_notes": False, "sort_order": 4, "is_builtin": False},
    {"ot_type": "repair", "code": "configurar_tv", "name": "Configurar TV", "description": "Configurar Smart TV u otro dispositivo", "requires_notes": False, "sort_order": 5, "is_builtin": False},
    {"ot_type": "repair", "code": "no_realizada", "name": "No Realizada", "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
    {"ot_type": "infrastructure", "code": "realizada", "name": "Realizada", "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
    {"ot_type": "infrastructure", "code": "no_realizada", "name": "No Realizada", "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
]


def upgrade() -> None:
    op.create_table(
        'wo_actions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ot_type', sa.String(50), nullable=False, index=True),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('requires_notes', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'), index=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_builtin', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.UniqueConstraint('ot_type', 'code', name='uq_wo_action_ot_type_code'),
        sa.PrimaryKeyConstraint('id'),
    )

    conn = op.get_bind()
    for a in SEED_ACTIONS:
        conn.execute(
            sa.text("""
                INSERT INTO wo_actions (ot_type, code, name, description, requires_notes, sort_order, is_builtin)
                VALUES (:ot_type, :code, :name, :description, :requires_notes, :sort_order, :is_builtin)
            """),
            a,
        )


def downgrade() -> None:
    op.drop_table('wo_actions')
