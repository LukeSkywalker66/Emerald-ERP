"""ensure canonical ticket_categories exist

Revision ID: 2026_10_07_005
Revises: 2026_10_07_004
Create Date: 2026-10-07 00:00:00.000000

Garantiza que las categorías canónicas de tickets existan en cualquier entorno.

Contexto: la creación de tickets se volvió data-driven a través de
`ticket_categories.flow_key`. Las migraciones anteriores sólo:
- 2026_10_07_001: agregó `flow_key` y backfilleó las categorías YA EXISTENTES.
- 2026_10_07_003: insertó únicamente 'Instalación Mesh'.

El resto de categorías ('Traslado', 'Pase a Fibra', etc.) dependía del seed
`scripts/seed_tickets.py`, que no forma parte del flujo de deploy y además está
roto (importa `TicketEvent`/`TicketEventType`, que no existen). Por eso, tras un
re-seed/borrado de datos, categorías como 'Traslado' desaparecían de "Crear
Ticket" y ninguna migración las restauraba.

Esta migración es idempotente: inserta lo que falta y corrige `flow_key` en las
que ya existen, sin pisar `description` ni `priority_default` de filas existentes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_07_005'
down_revision: Union[str, Sequence[str], None] = '2026_10_07_004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (name, description, priority_default, flow_key)
_CANONICAL_CATEGORIES = [
    ("Servicio Técnico", "Diagnóstico, reparación y tareas técnicas varias", "high", "technical"),
    ("Administrativo", "Cambios de plan y facturación", "low", "administrative"),
    ("Instalación", "Alta de nuevo servicio al cliente", "medium", "installation"),
    ("Instalación Mesh", "Instalación de sistema mesh inalámbrico (routers específicos) sobre conexión existente", "medium", "mesh"),
    ("Traslado", "Relocalización del cliente", "medium", "relocation"),
    ("Baja", "Cancelación de servicio", "low", "withdrawal"),
    ("Pase a Fibra", "Migración de conexión existente de aire a fibra óptica, con retiro de antena/equipo", "medium", "fiber_migration"),
]


def upgrade() -> None:
    bind = op.get_bind()
    for name, description, priority_default, flow_key in _CANONICAL_CATEGORIES:
        bind.execute(
            sa.text(
                """
                INSERT INTO ticket_categories (name, description, priority_default, flow_key)
                VALUES (:name, :description, :priority_default, :flow_key)
                ON CONFLICT (name) DO UPDATE
                    SET flow_key = EXCLUDED.flow_key
                    WHERE ticket_categories.flow_key IS NULL
                """
            ),
            {
                "name": name,
                "description": description,
                "priority_default": priority_default,
                "flow_key": flow_key,
            },
        )


def downgrade() -> None:
    # No se eliminan categorías: podrían tener tickets asociados (FK). La
    # operación inversa de "garantizar existencia" es no hacer nada destructivo.
    pass
