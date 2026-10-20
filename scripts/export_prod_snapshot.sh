#!/bin/bash
# ==============================================================================
# export_prod_snapshot.sh — Snapshot completo de PRODUCCIÓN (PostgreSQL + MinIO)
# Ejecutar en el host Debian de PRODUCCIÓN.
#
# Uso:
#   ./scripts/export_prod_snapshot.sh [directorio_salida]
#
# Genera un único .tar.gz con:
#   - emerald.dump         (pg_dump formato custom, restaurable con pg_restore)
#   - minio_data.tar.gz    (tar del volumen /data de MinIO, layout exacto)
#   - manifest.txt
#
# Nota: idealmente ejecutar en horario de bajo uso. pg_dump es consistente;
# MinIO se tarrea en caliente (riesgo mínimo para un snapshot de desarrollo).
# ==============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTDIR="${1:-$PROJECT_ROOT/snapshots}"
mkdir -p "$OUTDIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT="$OUTDIR/emerald_prod_snapshot_$TS.tar.gz"
WORK="$(mktemp -d)"

DB_CONTAINER="emerald_db"
MINIO_CONTAINER="emerald_minio"

echo "🟢 Exportando snapshot de producción ($TS)..."

# 1) PostgreSQL (formato custom)
echo "💾 Volcando PostgreSQL..."
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$WORK/emerald.dump"

# 2) MinIO: tar del volumen /data (preserva el layout exacto de objetos)
echo "📂 Volcando MinIO (/data)..."
MINIO_VOL="$(docker inspect "$MINIO_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')"
if [ -z "$MINIO_VOL" ]; then
  echo "❌ No se pudo detectar el volumen /data de $MINIO_CONTAINER"
  exit 1
fi
docker run --rm -v "$MINIO_VOL:/data:ro" -w /data alpine sh -c 'tar -czf - .' > "$WORK/minio_data.tar.gz"

# 3) Manifest informativo
{
  echo "created_at=$TS"
  echo "db_container=$DB_CONTAINER"
  echo "minio_container=$MINIO_CONTAINER"
  echo "minio_volume=$MINIO_VOL"
} > "$WORK/manifest.txt"

# 4) Empaquetado único
tar -C "$WORK" -czf "$OUT" emerald.dump minio_data.tar.gz manifest.txt
rm -rf "$WORK"

echo "✅ Snapshot listo:"
echo "   $OUT"
echo ""
echo "   Movelo al servidor de DESARROLLO y ejecutá:"
echo "   ./scripts/restore_dev_snapshot.sh <ruta/al/archivo.tar.gz>"
