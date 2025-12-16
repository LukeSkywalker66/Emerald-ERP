# backend/src/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Leemos la URL de conexión desde las variables de entorno (Docker)
# Si no existe (ej: probando local sin docker), usa una por defecto para que no falle
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:adminpassword@localhost:5432/emerald_stock")

# Creamos el motor de conexión
engine = create_engine(DATABASE_URL)

# Creamos la "Fábrica de Sesiones" (Cada petición tendrá su propia sesión)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Esta es la clase base de la que heredarán todos tus modelos
Base = declarative_base()

# Dependencia para obtener la DB en cada endpoint (FastAPI)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()