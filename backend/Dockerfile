FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir debugpy
COPY . .
# Ejecutar migraciones antes de iniciar
RUN python -c "from alembic import command; from alembic.config import Config; import os; cfg = Config('alembic.ini'); cfg.set_main_option('sqlalchemy.url', os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/db')); command.upgrade(cfg, 'head')" || true
CMD ["python", "-Xfrozen_modules=off", "-m", "debugpy", "--listen", "0.0.0.0:5678", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8500", "--reload"]