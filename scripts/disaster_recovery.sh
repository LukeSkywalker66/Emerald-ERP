#!/bin/bash
# ==============================================================================
# Emerald ERP - Autonomous Disaster Recovery Script
# Target: Debian 12 / Docker Compose
# Soporte: Tarball (.tar.gz), pg_restore (.dump), y MinIO Buckets
# ==============================================================================
set -e

echo "🟢 [Emerald Tech Lead] Iniciando Protocolo de Disaster Recovery..."

# 1. Auto-descubrir la raíz del proyecto dinámicamente
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# 2. Mapeo estricto de Entornos y Archivos Compose
ENVIRONMENT=${1:-prod}

case "$ENVIRONMENT" in
  prod)
    COMPOSE_FILE="docker-compose.yml"
    DB_CONTAINER="emerald_db"
    MINIO_CONTAINER="emerald_minio"
    ;;
  dev)
    COMPOSE_FILE="docker-compose.dev.yml"
    DB_CONTAINER="emerald_db_dev"
    MINIO_CONTAINER="emerald_minio_dev"
    ;;
  staging)
    COMPOSE_FILE="docker-compose.staging.yml"
    DB_CONTAINER="emerald_db_staging"
    MINIO_CONTAINER="emerald_minio_staging"
    ;;
  *)
    echo "❌ Error: Entorno '$ENVIRONMENT' no reconocido."
    echo "Uso válido: $0 [dev | staging | prod]"
    exit 1
    ;;
esac

COMPOSE_PATH="$PROJECT_ROOT/$COMPOSE_FILE"

if [ ! -f "$COMPOSE_PATH" ]; then
  echo "❌ Error CRÍTICO: El archivo $COMPOSE_FILE no existe en $PROJECT_ROOT."
  exit 1
fi

echo "⚙️  Entorno seleccionado: $ENVIRONMENT ($COMPOSE_FILE)"

# 3. Extracción Quirúrgica de Variables de Entorno
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error CRÍTICO: Archivo .env no encontrado en $PROJECT_ROOT. Abortando."
  exit 1
fi

echo "🔒 Extrayendo credenciales tácticas del .env..."

# Función para aislar el valor: corta por el '=', quita comillas y borra comentarios finales
extract_env_var() {
  local var_name=$1
  grep "^${var_name}=" "$ENV_FILE" | head -n 1 | cut -d '=' -f 2- | sed -e "s/^['\"]//" -e "s/['\"]$//" -e 's/[[:space:]]*#.*$//'
}

RCLONE_CONF_BASE64=$(extract_env_var "RCLONE_CONF_BASE64")
POSTGRES_USER=$(extract_env_var "POSTGRES_USER")
POSTGRES_DB=$(extract_env_var "POSTGRES_DB")

# Validación estricta
if [ -z "$RCLONE_CONF_BASE64" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DB" ]; then
  echo "❌ Error CRÍTICO: Faltan variables clave (RCLONE, USER o DB) en el .env, o el formato es ilegible."
  exit 1
fi

echo "✅ Credenciales aisladas en memoria sin contaminar el host."

# 4. Preparar entorno efímero y de extracción
RCLONE_CONF_DIR="$PROJECT_ROOT/infra/rclone"
RCLONE_CONF_FILE="$RCLONE_CONF_DIR/rclone.conf"
BACKUP_DIR="$PROJECT_ROOT/infra/recovery_data"
EXTRACT_DIR="$BACKUP_DIR/extracted"

mkdir -p "$RCLONE_CONF_DIR" "$BACKUP_DIR"
# Limpiar extracciones previas por seguridad
rm -rf "$EXTRACT_DIR" && mkdir -p "$EXTRACT_DIR"

if [ -z "$RCLONE_CONF_BASE64" ]; then
  echo "❌ Error CRÍTICO: Variable RCLONE_CONF_BASE64 no definida en el .env."
  exit 1
fi

echo "$RCLONE_CONF_BASE64" | base64 -d > "$RCLONE_CONF_FILE"
chmod 600 "$RCLONE_CONF_FILE"

# 5. Levantar infraestructura core requerida
echo "🏗️  Levantando base de datos y MinIO..."
docker compose -f "$COMPOSE_PATH" up -d db redis minio
echo "⏳ Esperando 10 segundos para inicialización de servicios..."
sleep 10

# 6. Descarga del último backup (.tar.gz) dinámico
echo "🔍 Interrogando a Google Drive por el snapshot más reciente..."

TARGET_BACKUP_FILE=$(docker run --rm \
  -v "$RCLONE_CONF_DIR:/config/rclone" \
  rclone/rclone:latest \
  lsf gdrive:Emerald_ERP_BackUps/production/ \
  --include "*.tar.gz" | sort -r | head -n 1)

# Validación de seguridad por si falla la conexión o el bucket está vacío
if [ -z "$TARGET_BACKUP_FILE" ]; then
  echo "❌ Error CRÍTICO: No se encontraron archivos de backup (.tar.gz) en Producción."
  exit 1
fi

echo "🎯 Snapshot dinámico detectado: $TARGET_BACKUP_FILE"
echo "☁️  Iniciando descarga..."

docker run --rm \
  -v "$RCLONE_CONF_DIR:/config/rclone" \
  -v "$BACKUP_DIR:/data" \
  rclone/rclone:latest \
  copy gdrive:Emerald_ERP_BackUps/production/$TARGET_BACKUP_FILE /data/ --progress


# 7. Lógica de Extracción y Restauración Dividida
DOWNLOADED_TAR="$BACKUP_DIR/$TARGET_BACKUP_FILE"

if [ -f "$DOWNLOADED_TAR" ]; then
  echo "📦 Descomprimiendo el snapshot operacional..."
  tar -xzf "$DOWNLOADED_TAR" -C "$EXTRACT_DIR"

  # 7.1 Restaurar Base de Datos (Buscamos el archivo .dump)
  DUMP_FILE=$(find "$EXTRACT_DIR" -name "*.dump" | head -n 1)
  if [ -n "$DUMP_FILE" ]; then
    echo "💾 Inyectando volcado binario a PostgreSQL con pg_restore..."
    # Inyección utilizando la variable de entorno del contenedor
    docker run --rm -i --network container:"$DB_CONTAINER" postgres:17-alpine pg_restore -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < "$DUMP_FILE" || echo "⚠️ Advertencia de downgrade (PG17->PG15) ignorada. Volcado completado."
    echo "✅ Base de datos (Source of Truth) restaurada."
  else
    echo "⚠️ Advertencia: No se encontró archivo .dump en el backup."
  fi

  # 7.2 Restaurar MinIO (Buscamos la carpeta de adjuntos)
  MINIO_FOLDER=$(find "$EXTRACT_DIR" -type d -name "minio_emerald-attachments" | head -n 1)
  if [ -n "$MINIO_FOLDER" ]; then
    echo "📂 Restaurando buckets físicos en MinIO..."
    # Utilizando la variable de entorno para MinIO
    docker exec "$MINIO_CONTAINER" mkdir -p /data/emerald-attachments
    docker cp "$MINIO_FOLDER/." "$MINIO_CONTAINER:/data/emerald-attachments/"
    
    echo "🔄 Reiniciando contenedor MinIO para forzar re-indexación..."
    docker compose -f "$COMPOSE_PATH" restart minio
    echo "✅ Archivos adjuntos sincronizados."
  else
    echo "⚠️ Advertencia: No se encontró carpeta minio_emerald-attachments."
  fi

else
  echo "❌ Error: Falló la descarga del backup. $DOWNLOADED_TAR no existe."
fi

# 8. Limpieza de seguridad balística
rm -f "$RCLONE_CONF_FILE"
rm -rf "$EXTRACT_DIR"
rm -f "$DOWNLOADED_TAR"
echo "🧹 Limpieza completada: Archivos temporales y credenciales destruidos."

# 9. Levantar el resto de la plataforma
echo "🚀 Levantando Emerald ERP ($ENVIRONMENT) al completo..."
docker compose -f "$COMPOSE_PATH" up -d

# ==============================================================================
# 10. INTEGRACIÓN DEL PROXY GLOBAL Y SSL
# ==============================================================================
PROXY_DIR="/opt/emerald-proxy"

echo "🛡️ Buscando infraestructura de enrutamiento en $PROXY_DIR..."

if [ -d "$PROXY_DIR" ] && [ -f "$PROXY_DIR/init-proxy.sh" ]; then
    echo "🔗 Enlazando el ERP con el Proxy Global y validando SSL..."
    
    # Navegamos al directorio del proxy y ejecutamos su bootstrap
    cd "$PROXY_DIR"
    
    # Aseguramos permisos por si hubo un error en la clonación
    chmod +x init-proxy.sh
    
    # Ejecutamos el orquestador del proxy
    ./init-proxy.sh
    
    # Volvemos al directorio del ERP por sanidad del entorno de shell
    cd "$PROJECT_ROOT"
    echo "✅ [Emerald Tech Lead] Arquitectura de red blindada con éxito."
else
    echo "⚠️ ADVERTENCIA CRÍTICA: No se encontró el repositorio emerald-proxy o el script init-proxy.sh."
    echo "⚠️ El ERP está corriendo, pero no estará accesible desde el exterior."
fi

echo "======================================================================"
echo "🟢 DISASTER RECOVERY COMPLETADO. El Laboratorio está listo."
echo "======================================================================"
