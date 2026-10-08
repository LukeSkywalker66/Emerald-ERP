"""backfill roles.capabilities + is_field_technician

Revision ID: 2026_10_07_006
Revises: 2026_10_07_005
Create Date: 2026-10-07 00:00:00.000000

Contexto: `2026_10_05_001` sólo AGREGÓ la columna `roles.capabilities` (JSONB) y
`2026_10_05_002` agregó `roles.is_field_technician`, pero ninguna pobló valores.
El poblado se hacía con el SCRIPT `scripts/seed_rbac_capabilities.py`, que NO
forma parte del deploy (el pipeline sólo corre `alembic upgrade head`).

Consecuencia en producción: los roles quedaron con `capabilities = NULL`, y
`build_capabilities()` devuelve `[]` para usuarios no-superuser. El endpoint de
OTs filtra a "sólo las propias" cuando faltan `work_orders.view_all`/`*`, por lo
que un admin (no-superuser) veía la lista de OTs vacía, como un técnico sin
asignaciones.

Esta migración replica el seed de forma idempotente como MIGRACIÓN DE DATOS para
que corra automáticamente en el deploy (source of truth en alembic).
"""
from __future__ import annotations

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_07_006'
down_revision: Union[str, Sequence[str], None] = '2026_10_07_005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Slugs canónicos por rol (espejo de scripts/seed_rbac_capabilities.py).
CAPABILITIES: dict[str, list[str]] = {
    "admin": ["*"],

    "tecnico": [
        "tickets.view",
        "work_orders.view",
        "work_orders.complete",
        "inventory.view",
        "inventory_warehouses.view",
        "fleet_assigned.view",
        "self_service.view",
        "self_service.edit",
    ],

    "operador": [
        "dashboard.view",
        "tickets.view", "tickets.create", "tickets.edit", "tickets.comment",
        "coordination.view", "coordination.assign", "coordination.unassign", "coordination.view_teams",
        "work_orders.view", "work_orders.view_all", "work_orders.create", "work_orders.edit", "work_orders.complete",
        "engineering.view", "engineering.manage",
        "cuadrillas.view", "cuadrillas.create", "cuadrillas.edit", "cuadrillas.delete", "cuadrillas.assign_members",
        "inventory.view", "inventory.view_all", "inventory.edit", "inventory.transfer", "inventory.adjust",
        "inventory_warehouses.view",
        "inventory_admin.view",
        "fleet_assigned.view",
        "connections.view", "nodes.view", "clients.view",
        "self_service.view", "self_service.edit",
    ],

    "tecnico_encargado": [
        "dashboard.view",
        "tickets.view", "tickets.create", "tickets.edit", "tickets.comment",
        "coordination.view", "coordination.assign", "coordination.unassign", "coordination.view_teams",
        "work_orders.view", "work_orders.view_all", "work_orders.create", "work_orders.edit", "work_orders.complete",
        "inventory.view", "inventory.view_all", "inventory.transfer", "inventory.adjust",
        "inventory_warehouses.view",
        "inventory_admin.view",
        "fleet_assigned.view",
        "cuadrillas.view",
        "connections.view", "nodes.view", "clients.view",
        "self_service.view", "self_service.edit",
    ],
}

FIELD_TECHNICIAN_ROLES: set[str] = {"tecnico", "tecnico_encargado"}


def upgrade() -> None:
    bind = op.get_bind()

    for name, caps in CAPABILITIES.items():
        is_field_technician = name in FIELD_TECHNICIAN_ROLES
        bind.execute(
            sa.text(
                """
                INSERT INTO roles (name, permissions, capabilities, is_field_technician)
                VALUES (:name, '[]'::jsonb, CAST(:caps AS jsonb), :is_field_technician)
                ON CONFLICT (name) DO UPDATE
                    SET capabilities = EXCLUDED.capabilities,
                        is_field_technician = EXCLUDED.is_field_technician
                """
            ),
            {
                "name": name,
                "caps": json.dumps(caps),
                "is_field_technician": is_field_technician,
            },
        )

    # Roles fuera del catálogo canónico: normalizar el flag de perfil a false
    # (un rol no canónico no es técnico de campo, igual que el seed).
    bind.execute(
        sa.text(
            """
            UPDATE roles
            SET is_field_technician = false
            WHERE name NOT IN ('tecnico', 'tecnico_encargado')
            """
        )
    )


def downgrade() -> None:
    # No se borran capabilities: es un backfill de datos. La operación inversa
    # sería dejar NULL, lo cual reintroduce el bug; no hacemos nada destructivo.
    pass
