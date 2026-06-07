"""seed_work_order_types

Revision ID: 2026_06_07_001
Revises: 2026_06_06_002
Create Date: 2026-06-07 10:00:00.000000

Inserta/configura los tipos base de OT en work_order_types.
Los tipos son editables desde Settings > Tipos de OT.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_07_001'
down_revision: Union[str, Sequence[str], None] = '2026_06_06_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


BASE_TYPES = [
    {
        "code": "install_ftth",
        "name": "Instalación FTTH",
        "description": "Instalación de fibra óptica hasta el hogar",
        "color": "bg-blue-600",
        "icon": "Zap",
        "is_active": True,
    },
    {
        "code": "install_aire",
        "name": "Instalación Aire",
        "description": "Instalación de antena/radio enlace",
        "color": "bg-sky-600",
        "icon": "Wifi",
        "is_active": True,
    },
    {
        "code": "repair",
        "name": "Reclamo",
        "description": "Soporte técnico y reparaciones",
        "color": "bg-emerald-600",
        "icon": "Wrench",
        "is_active": True,
    },
    {
        "code": "pickup",
        "name": "Baja",
        "description": "Retiro de equipos y baja de servicio",
        "color": "bg-rose-600",
        "icon": "Package",
        "is_active": True,
    },
    {
        "code": "infrastructure",
        "name": "Infraestructura",
        "description": "Trabajos de cuadrilla en postes y red",
        "color": "bg-purple-600",
        "icon": "TowerControl",
        "is_active": True,
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    for t in BASE_TYPES:
        existing = conn.execute(
            sa.text("SELECT id FROM work_order_types WHERE code = :code"),
            {"code": t["code"]},
        ).fetchone()

        if existing:
            # Actualizar registro existente
            conn.execute(
                sa.text("""
                    UPDATE work_order_types
                    SET name = :name, description = :description,
                        color = :color, icon = :icon, is_active = :is_active
                    WHERE code = :code
                """),
                t,
            )
        else:
            # Insertar nuevo
            conn.execute(
                sa.text("""
                    INSERT INTO work_order_types (code, name, description, color, icon, is_active)
                    VALUES (:code, :name, :description, :color, :icon, :is_active)
                """),
                t,
            )


def downgrade() -> None:
    conn = op.get_bind()
    codes = [t["code"] for t in BASE_TYPES]
    for code in codes:
        conn.execute(
            sa.text("DELETE FROM work_order_types WHERE code = :code"),
            {"code": code},
        )
