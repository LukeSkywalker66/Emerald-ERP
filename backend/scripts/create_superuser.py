#!/usr/bin/env python3
"""
Script para crear un usuario superadmin inicial.

Uso:
    python -m scripts.create_superuser
    
    # O con variables de entorno:
    ADMIN_EMAIL=admin@emerald.com ADMIN_PASSWORD=Admin123 python -m scripts.create_superuser
"""
import os
import sys
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

from src.database import SessionLocal, init_db
from src.models.user import User, Role
from src.repositories.user_repository import UserRepository, RoleRepository
from src.services.auth_service import AuthService
from src.schemas.user_schemas import UserCreate


def create_default_roles(db: Session) -> dict[str, Role]:
    """Crea los roles por defecto del sistema."""
    role_repo = RoleRepository(db)
    
    default_roles = {
        "admin": {
            "name": "admin",
            "permissions": ["*"]
        },
        "tecnico": {
            "name": "tecnico",
            "permissions": [
                "tickets:read",
                "tickets:write",
                "services:read",
                "clients:read",
                "diagnosis:read",
            ]
        },
        "viewer": {
            "name": "viewer",
            "permissions": [
                "tickets:read",
                "services:read",
                "clients:read",
            ]
        }
    }
    
    created_roles = {}
    
    for role_key, role_data in default_roles.items():
        existing = role_repo.get_by_name(role_data["name"])
        
        if not existing:
            role = Role(**role_data)
            created_role = role_repo.create(role)
            print(f"✅ Rol creado: {created_role.name}")
            created_roles[role_key] = created_role
        else:
            print(f"ℹ️  Rol '{role_data['name']}' ya existe")
            created_roles[role_key] = existing
    
    return created_roles


def create_superuser(
    db: Session,
    email: str,
    username: str,
    password: str,
    full_name: str,
    admin_role_id: int
) -> User:
    """Crea un usuario superadministrador."""
    user_repo = UserRepository(db)
    
    # Verificar si ya existe
    existing = user_repo.get_by_email(email)
    if existing:
        print(f"⚠️  Usuario con email '{email}' ya existe")
        return existing
    
    existing = user_repo.get_by_username(username)
    if existing:
        print(f"⚠️  Usuario con username '{username}' ya existe")
        return existing
    
    # Crear usuario usando AuthService
    auth_service = AuthService(user_repo, db)
    
    user_data = UserCreate(
        email=email,
        username=username,
        password=password,
        full_name=full_name,
        role_id=admin_role_id
    )
    
    user = auth_service.register_user(user_data)
    
    # Marcarlo como superusuario
    user.is_superuser = True
    user_repo.update(user)
    
    print(f"✅ Superusuario creado: {user.username} ({user.email})")
    
    return user


def main():
    """Función principal del script"""
    print("=" * 60)
    print("🔐 Creador de Superusuario - Emerald ERP")
    print("=" * 60)
    print()
    
    # Leer variables de entorno o usar defaults
    admin_email = os.getenv("ADMIN_EMAIL", "admin@emerald.com")
    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin123")
    admin_full_name = os.getenv("ADMIN_FULL_NAME", "Administrador del Sistema")
    
    print("📋 Configuración:")
    print(f"   Email:    {admin_email}")
    print(f"   Username: {admin_username}")
    print(f"   Password: {'*' * len(admin_password)}")
    print(f"   Nombre:   {admin_full_name}")
    print()
    
    # Confirmar
    if not os.getenv("ADMIN_EMAIL"):
        confirm = input("¿Deseas continuar? (y/n): ")
        if confirm.lower() != 'y':
            print("❌ Operación cancelada")
            return
    
    print()
    print("🔄 Inicializando base de datos...")
    
    # Inicializar DB (ejecutar migraciones)
    try:
        init_db()
        print("✅ Base de datos inicializada")
    except Exception as e:
        print(f"⚠️  Error al inicializar DB: {e}")
        print("   Continuando de todas formas...")
    
    print()
    print("🔄 Creando roles por defecto...")
    
    # Crear sesión
    db = SessionLocal()
    
    try:
        # Crear roles
        roles = create_default_roles(db)
        
        print()
        print("🔄 Creando superusuario...")
        
        # Crear superuser
        superuser = create_superuser(
            db=db,
            email=admin_email,
            username=admin_username,
            password=admin_password,
            full_name=admin_full_name,
            admin_role_id=roles["admin"].id
        )
        
        print()
        print("=" * 60)
        print("✅ PROCESO COMPLETADO")
        print("=" * 60)
        print()
        print("📝 Credenciales de acceso:")
        print(f"   Email:    {superuser.email}")
        print(f"   Username: {superuser.username}")
        print(f"   Password: {admin_password}")
        print()
        print("🔗 Puedes iniciar sesión en:")
        print("   POST /api/v1/auth/login")
        print()
        
    except Exception as e:
        print()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
