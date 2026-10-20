#!/bin/bash
# ==============================================================================
# restore_dev_snapshot.sh — Restaura en DESARROLLO un snapshot de producción.
# Ejecutar en el host de DESARROLLO.
#
# Uso:
#   ./scripts/restore_dev_snapshot.sh /ruta/al/emerald_prod_snapshot_*.tar.gz
#
# Reemplaza por completo la base PostgreSQL y el volumen MinIO de desarrollo.
# ==============================================================================
set -euo pipefail

PKG="${1:?Uso: $0 /ruta/al/emerald_prod_snapshot_*.tar.gz}"
[ -f "$PKG" ] || { echo "❌ No existe el archivo: $PKG"; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"

DB_CONTAINER="emerald_db_dev"
MINIO_CONTAINER="emerald_minio_dev"

extract_env_var() {
  grep "^$1=" "$ENV_FILE" | head -n1 | cut -d'=' -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//" -e 's/[[:space:]]*#.*$//'
}
POSTGRES_USER="$(extract_env_var POSTGRES_USER)"
POSTGRES_DB="$(extract_env_var POSTGRES_DB)"
[ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_DB" ] || { echo "❌ Faltan POSTGRES_USER/POSTGRES_DB en .env"; exit 1; }

WORK="$(mktemp -d)"
echo "🟢 Restaurando snapshot en DESARROLLO..."
echo "📦 Extrayendo $PKG..."
tar -xzf "$PKG" -C "$WORK"

# 1) Detener servicios que usan la BD durante la restauración
echo "⏸️  Pausando backend/worker..."
docker compose -f "$COMPOSE_FILE" stop backend celery_worker

# 2) PostgreSQL
echo "💾 Restaurando PostgreSQL en $DB_CONTAINER..."
docker exec -i "$DB_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < "$WORK/emerald.dump"
echo "✅ Base de datos restaurada"

# 3) MinIO
echo "📂 Restaurando MinIO (/data)..."
MINIO_VOL="$(docker inspect "$MINIO_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')"
[ -n "$MINIO_VOL" ] || { echo "❌ No se detectó el volumen /data de $MINIO_CONTAINER"; exit 1; }

docker compose -f "$COMPOSE_FILE" stop minio
docker run --rm -v "$MINIO_VOL:/data" -i alpine sh -c 'find /data -mindepth 1 -delete; tar -C /data -xzf -' < "$WORK/minio_data.tar.gz"
docker compose -f "$COMPOSE_FILE" start minio
echo "✅ MinIO restaurado"

# 4) Levantar el stack de desarrollo completo
echo "🚀 Levantando stack de desarrollo..."
docker compose -f "$COMPOSE_FILE" up -d

rm -rf "$WORK"
echo "✅ DESARROLLO sincronizado con producción."
