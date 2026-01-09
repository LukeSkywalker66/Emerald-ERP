#!/usr/bin/env python3
"""
Script para promover un usuario a superuser directamente en la BD.
Uso: python3 promote_superuser.py <email>
"""
import sys
import os

# Agregar el directorio backend/src al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from sqlalchemy import create_engine, text
from src.config import SQLALCHEMY_DATABASE_URL

def promote_to_superuser(email: str):
    """Promueve un usuario a superuser."""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    with engine.connect() as conn:
        # Verificar que el usuario existe
        result = conn.execute(
            text("SELECT id, email, username, is_superuser FROM users WHERE email = :email"),
            {"email": email}
        )
        user = result.fetchone()
        
        if not user:
            print(f"❌ Usuario con email '{email}' no encontrado")
            return False
        
        print(f"📋 Usuario encontrado:")
        print(f"   ID: {user[0]}")
        print(f"   Email: {user[1]}")
        print(f"   Username: {user[2]}")
        print(f"   Superuser actual: {user[3]}")
        
        if user[3]:
            print(f"✅ El usuario ya es superuser")
            return True
        
        # Promover a superuser
        conn.execute(
            text("UPDATE users SET is_superuser = true WHERE email = :email"),
            {"email": email}
        )
        conn.commit()
        
        print(f"✅ Usuario promovido a superuser exitosamente")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 promote_superuser.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    success = promote_to_superuser(email)
    sys.exit(0 if success else 1)
