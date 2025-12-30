#!/usr/bin/env python3
"""
Script rápido para crear admin sin confirmar interactivamente.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.database import SessionLocal
from src.models.user import User, Role
from src.repositories.user_repository import UserRepository, RoleRepository
from src.services.auth_service import AuthService
from src.schemas.user_schemas import UserCreate

db = SessionLocal()

try:
    # Crear roles
    role_repo = RoleRepository(db)
    
    for name, perms in [
        ("admin", ["*"]),
        ("tecnico", ["tickets:read", "tickets:write", "services:read", "clients:read", "diagnosis:read"]),
        ("viewer", ["tickets:read", "services:read", "clients:read"]),
    ]:
        if not role_repo.get_by_name(name):
            role = Role(name=name, permissions=perms)
            role_repo.create(role)
            print(f"✅ Rol {name}")

    # Crear admin
    user_repo = UserRepository(db)
    email = os.getenv("ADMIN_EMAIL", "admin@emerald.com")
    password = os.getenv("ADMIN_PASSWORD", "Admin@123")
    
    if user_repo.get_by_email(email):
        print(f"⚠️ Admin ya existe")
    else:
        auth_service = AuthService(user_repo, db)
        user_data = UserCreate(
            email=email,
            username="admin",
            password=password,
            full_name="Administrador",
            role_id=role_repo.get_by_name("admin").id
        )
        user = auth_service.register_user(user_data)
        user.is_superuser = True
        user_repo.update(user)
        print(f"✅ Admin creado: {email}")

finally:
    db.close()
