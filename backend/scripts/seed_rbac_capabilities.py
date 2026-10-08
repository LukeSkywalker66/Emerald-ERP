#!/usr/bin/env python3
"""Seed de capabilities RBAC canónicas en roles (slugs `recurso.accion`).

Idempotente: actualiza `roles.capabilities` y `roles.is_field_technician` de los
roles existentes y crea el rol `tecnico_encargado` si no existe. NO toca
`roles.permissions` (legacy v1), por lo que no afecta a los endpoints que aún
consumen ese formato.

Elegibilidad de perfil (cuadrilla) vs. permisos:
- `roles.capabilities` responde "qué puede hacer" (y `["*"]` otorga todo).
- `roles.is_field_technician` responde "qué perfil ES" (técnico de campo). Es un
  atributo de datos del rol, NO una capability, por lo que el wildcard `["*"]`
  no lo habilita: un `admin` tiene todos los permisos pero NO es técnico de campo
  y no debe aparecer como miembro elegible de una cuadrilla.
"""
from __future__ import annotations

import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_path))

from src.database import SessionLocal
from src.models.user import Role


# Slugs canónicos por rol. Equivalente a la matriz actual del frontend para
# admin/tecnico/operador (sin cambio de comportamiento) + el rol nuevo.
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

# Perfil (no permiso): roles que pueden integrar una cuadrilla como técnicos.
# La eligibility se resuelve en el backend por `roles.is_field_technician`.
FIELD_TECHNICIAN_ROLES: set[str] = {"tecnico", "tecnico_encargado"}


def seed() -> None:
    db = SessionLocal()
    try:
        for name, caps in CAPABILITIES.items():
            is_field_technician = name in FIELD_TECHNICIAN_ROLES
            role = db.query(Role).filter(Role.name == name).first()
            if role:
                role.capabilities = caps
                role.is_field_technician = is_field_technician
                print(f"  ✓ actualizado: {name} ({len(caps)} caps, field_technician={is_field_technician})")
            else:
                db.add(Role(
                    name=name,
                    capabilities=caps,
                    permissions=[],
                    is_field_technician=is_field_technician,
                ))
                print(f"  + creado: {name} ({len(caps)} caps, field_technician={is_field_technician})")

        # Roles existentes no incluidos en CAPABILITIES: normalizar solo el flag.
        for other in db.query(Role).filter(Role.name.notin_(list(CAPABILITIES.keys()))).all():
            flag = other.name in FIELD_TECHNICIAN_ROLES
            if other.is_field_technician != flag:
                other.is_field_technician = flag
                db.add(other)
                print(f"  ✓ normalizado flag: {other.name} -> is_field_technician={flag}")

        db.commit()
        print("Seed RBAC capabilities completo.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
