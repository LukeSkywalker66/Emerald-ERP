# backend/src/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
# IMPORTANTE: Importamos la URL desde nuestra configuración centralizada
from src.config import SQLALCHEMY_DATABASE_URL

# Creamos el motor usando la URL que armó config.py
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependencia para FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()