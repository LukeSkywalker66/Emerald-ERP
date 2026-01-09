import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# 1. Agregamos la ruta 'src' para que Python encuentre tus archivos
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

# 2. Importar AMBAS bases de datos (vieja y nueva arquitectura)
# Base vieja (para mantener tablas existentes)
from src.database import Base as OldBase
from src.models import *  # Modelos antiguos (Ticket, Service, Client, etc.)

# Base nueva (para agregar usuarios y roles)
from src.database.base import Base as NewBase
from src.models.user import Role, User  # Modelos nuevos

# Combinar metadata de ambas bases
# Usando create_map=False evita warnings sobre tablas duplicadas
from sqlalchemy import MetaData
combined_metadata = MetaData()

# Agregar tablas de la base vieja (Beholder legacy)
for table_name, table in OldBase.metadata.tables.items():
    if table_name not in combined_metadata.tables:
        table.to_metadata(combined_metadata)

# Agregar tablas de la base nueva (Auth, Tickets, nuevos módulos)
for table_name, table in NewBase.metadata.tables.items():
    if table_name not in combined_metadata.tables:
        table.to_metadata(combined_metadata)

from config import SQLALCHEMY_DATABASE_URL
# --------------------

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# Le decimos a Alembic que mire nuestros modelos para saber qué tablas crear
target_metadata = combined_metadata
# Sobreescribimos la URL del archivo .ini con la real configurada
config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
