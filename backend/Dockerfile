FROM python:3.11-slim-bookworm

# ═══════════════════════════════════════════════════════════════════════════════
# PostgreSQL client version is pinned to match the database server image used in
# docker-compose*.yml (postgres:15-alpine). This is critical because pg_dump
# writes archives that pg_restore can only read if the restore client is the
# same major version or newer. A pg_dump 17 running against a PG 15 server
# produces dumps that pg_restore 15 cannot restore.
#
# The client is installed from the official PostgreSQL APT repository (PGDG) so
# the exact major version can be pinned regardless of what the Debian base image
# ships by default.
# ═══════════════════════════════════════════════════════════════════════════════
ARG POSTGRES_MAJOR=15

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-archive-keyring.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client-${POSTGRES_MAJOR} \
        iputils-ping \
        netcat-openbsd \
        unzip \
        openssh-client \
    && curl -fsSL https://rclone.org/install.sh | bash \
    && rm -rf /var/lib/apt/lists/*

# Fail fast at build time if the installed client does not match the pinned major
RUN pg_dump --version && pg_dump --version | grep -q " ${POSTGRES_MAJOR}\."
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir debugpy
COPY . .
# Ejecutar migraciones antes de iniciar
RUN python -c "from alembic import command; from alembic.config import Config; import os; cfg = Config('alembic.ini'); cfg.set_main_option('sqlalchemy.url', os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/db')); command.upgrade(cfg, 'head')" || true
#CMD ["python", "-Xfrozen_modules=off", "-m", "debugpy", "--listen", "0.0.0.0:5678", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8500", "--reload"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8500", "--workers", "4"]