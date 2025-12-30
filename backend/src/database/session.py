"""
Configuración de sesión SQLAlchemy 2.0 compatible con sistema existente
"""
import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from src import config


# Engine con configuración de producción
engine = create_engine(
    config.SQLALCHEMY_DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verifica conexiones antes de usar
    pool_recycle=3600,   # Recicla conexiones cada hora
    echo=False,          # Cambiar a True para debug SQL
    future=True          # Usa SQLAlchemy 2.0 API
)


# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,  # Evita lazy loading después de commit
    class_=Session
)


# Dependency para FastAPI (compatible con el sistema existente)
def get_db() -> Generator[Session, None, None]:
    """
    Dependency que provee una sesión de base de datos.
    
    Uso en FastAPI:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            ...
    
    Yields:
        Session: Sesión activa de SQLAlchemy
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Inicializa la base de datos ejecutando migraciones Alembic.
    
    IMPORTANTE: NO usa create_all() para evitar inconsistencias.
    Las tablas se crean únicamente via Alembic migrations.
    """
    from alembic import command as alembic_command
    from alembic.config import Config as AlembicConfig

    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    alembic_ini = os.path.join(here, "alembic.ini")
    alembic_dir = os.path.join(here, "alembic")

    cfg = AlembicConfig(alembic_ini)
    cfg.set_main_option("script_location", alembic_dir)
    cfg.set_main_option("sqlalchemy.url", config.SQLALCHEMY_DATABASE_URL)

    alembic_command.upgrade(cfg, "head")
