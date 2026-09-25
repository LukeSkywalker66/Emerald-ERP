#!/usr/bin/env python3
"""
Seed de usuarios de prueba para la suite RBAC (Fase 1).

Crea de forma idempotente un usuario por rol con credenciales conocidas,
para que la prueba E2E de RBAC pueda loguear y validar qué módulos ve
cada rol. No renombra ni elimina roles existentes; solo crea lo que falta
y corrige el rol/flag de los usuarios de prueba si ya existen.

Uso (dentro del contenedor backend):
    python3 /app/scripts/seed_rbac_test_users.py

Variables de entorno opcionales:
    RBAC_TEST_PASSWORD  (default: "Admin123")
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.database import SessionLocal
from src.models.user import Role
from src.repositories.user_repository import UserRepository, RoleRepository
from src.services.auth_service import AuthService
from src.schemas.user_schemas import UserCreate

PASSWORD = os.getenv("RBAC_TEST_PASSWORD", "Admin123")

# (name, permissions) — se crean solo si no existen. No se pisan permisos existentes.
ROLES = [
    ("admin", ["*"]),
    ("tecnico", ["tickets:read", "tickets:write", "services:read", "clients:read", "diagnosis:read"]),
    ("operador", ["ticket:read", "ticket:write"]),
    ("viewer", ["tickets:read", "services:read", "clients:read"]),
]

# (email, username, full_name, role_name, is_superuser)
USERS = [
    ("rbac.admin@emerald.test", "rbac_admin", "RBAC Admin", "admin", True),
    ("rbac.operator@emerald.test", "rbac_operator", "RBAC Operador", "operador", False),
    ("rbac.technician@emerald.test", "rbac_technician", "RBAC Técnico", "tecnico", False),
    ("rbac.viewer@emerald.test", "rbac_viewer", "RBAC Viewer", "viewer", False),
]


def main() -> None:
    db = SessionLocal()
    try:
        role_repo = RoleRepository(db)
        user_repo = UserRepository(db)

        role_by_name = {}
        for name, perms in ROLES:
            role = role_repo.get_by_name(name)
            if not role:
                role = Role(name=name, permissions=perms)
                role_repo.create(role)
                print(f"✅ Rol creado: {name}")
            role_by_name[name] = role

        auth_service = AuthService(user_repo, db)
        for email, username, full_name, role_name, is_superuser in USERS:
            existing = user_repo.get_by_email(email)
            if existing:
                changed = False
                if existing.role_id != role_by_name[role_name].id:
                    existing.role_id = role_by_name[role_name].id
                    changed = True
                if existing.is_superuser != is_superuser:
                    existing.is_superuser = is_superuser
                    changed = True
                if changed:
                    user_repo.update(existing)
                print(f"♻️  Usuario existente {'actualizado' if changed else 'OK'}: {email} (rol={role_name})")
            else:
                user_data = UserCreate(
                    email=email,
                    username=username,
                    password=PASSWORD,
                    full_name=full_name,
                    role_id=role_by_name[role_name].id,
                )
                user = auth_service.register_user(user_data)
                user.is_superuser = is_superuser
                user_repo.update(user)
                print(f"✅ Usuario creado: {email} (rol={role_name})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
