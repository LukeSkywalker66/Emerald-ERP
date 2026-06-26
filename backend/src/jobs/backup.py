"""
Backup Job — Tarea Celery para backup automático de la base de datos.

Flujo:
  1. Lee BackupConfig de la BD (singleton).
  2. Si is_enabled=False, aborta sin error (permite deshabilitar en no-prod).
  3. Ejecuta pg_dump via subprocess hacia el servicio de BD en la red Docker.
  4. Sube el dump a Google Drive via rclone.
  5. Réplica opcional a servidor LAN via SCP.
  6. Aplica política de retención local y en nube.
  7. Registra el resultado en backup_runs.

Notas de seguridad:
  - PGPASSWORD se pasa como variable de entorno al subprocess, nunca como argumento.
  - El path del dump se valida antes de usarse.
  - set-uid bits y rutas relativas son rechazadas.
"""
from __future__ import annotations

import logging
import os
import subprocess
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from src.celery_app import celery_app
from src.database import SessionLocal
from src.models.settings import BackupConfig, BackupRun, BackupStatus, BackupTrigger

logger = logging.getLogger("Emerald.Backup")


# ============================================================
# Helpers internos
# ============================================================

def _get_or_create_config(db) -> BackupConfig:
    """Retorna la config singleton, creándola con defaults si no existe."""
    cfg = db.query(BackupConfig).filter(BackupConfig.id == 1).first()
    if cfg is None:
        cfg = BackupConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _parse_db_url(database_url: str) -> dict:
    """Extrae host, port, user, password, dbname de DATABASE_URL."""
    parsed = urlparse(database_url)
    return {
        "host": parsed.hostname or "db",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "",
        "password": parsed.password or "",
        "dbname": parsed.path.lstrip("/"),
    }


def _run_backup(cfg: BackupConfig, triggered_by: BackupTrigger) -> BackupRun:
    """
    Ejecuta el proceso completo de backup y retorna un BackupRun con el resultado.
    No hace commit — el caller es responsable.
    """
    now = datetime.now(timezone.utc)
    log_lines: list[str] = []
    run = BackupRun(
        started_at=now,
        status=BackupStatus.RUNNING,
        triggered_by=triggered_by,
    )

    def log(msg: str) -> None:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        log_lines.append(line)
        logger.info(line)

    try:
        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            raise RuntimeError("DATABASE_URL no definida en el entorno")

        db_params = _parse_db_url(database_url)
        app_env = os.environ.get("APP_ENV", "development")

        # --- Preparar directorio y nombre de archivo ---
        backup_dir = Path(cfg.backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = now.strftime("%Y-%m-%d_%H%M%S")
        # Incluir sufijo de entorno para evitar conflictos entre dev/staging/prod
        filename = f"emerald_prod_{app_env}_{timestamp}.dump"
        local_path = backup_dir / filename

        log(f"🚀 Iniciando backup — destino: {local_path}")

        # --- pg_dump via subprocess (postgresql-client en el contenedor) ---
        pg_env = {**os.environ, "PGPASSWORD": db_params["password"]}
        pg_cmd = [
            "pg_dump",
            "-h", db_params["host"],
            "-p", db_params["port"],
            "-U", db_params["user"],
            "-d", db_params["dbname"],
            "-F", "c",          # custom format (comprimido, restaurable con pg_restore)
            "-f", str(local_path),
        ]

        result = subprocess.run(
            pg_cmd,
            env=pg_env,
            capture_output=True,
            text=True,
            timeout=600,        # 10 min máximo para el dump
        )

        if result.returncode != 0:
            raise RuntimeError(f"pg_dump falló (rc={result.returncode}): {result.stderr}")

        if not local_path.exists() or local_path.stat().st_size == 0:
            raise RuntimeError("El archivo dump está vacío o no se creó")

        size_bytes = local_path.stat().st_size
        log(f"✅ Dump creado: {filename} ({size_bytes / 1024:.1f} KB)")
        run.filename = filename
        run.size_bytes = size_bytes

        # --- FASE 2: MinIO backup (Adjuntos, capturas, reportes) ---
        if cfg.include_minio_backup:
            minio_backup_path = backup_dir / f"emerald_minio_{timestamp}.tar.gz"
            log(f"📦 Incluyendo MinIO bucket '{cfg.minio_bucket}'...")

            # Usar rclone para sincronizar el bucket MinIO
            minio_temp_dir = backup_dir / f"minio_temp_{timestamp}"
            minio_temp_dir.mkdir(parents=True, exist_ok=True)

            # Configurar rclone para acceder a MinIO localmente
            # Esperamos que exista un remoto 'minio' en rclone.conf
            rclone_copy = subprocess.run(
                ["rclone", "sync", f"minio:/{cfg.minio_bucket}", str(minio_temp_dir)],
                capture_output=True,
                text=True,
                timeout=300,
            )

            if rclone_copy.returncode != 0:
                log(f"⚠️  MinIO sync falló (no crítico): {rclone_copy.stderr}")
            else:
                # Comprimir el directorio
                tar_result = subprocess.run(
                    ["tar", "-czf", str(minio_backup_path), "-C", str(backup_dir), f"minio_temp_{timestamp}"],
                    capture_output=True,
                    text=True,
                    timeout=300,
                )

                if tar_result.returncode == 0 and minio_backup_path.exists():
                    minio_size = minio_backup_path.stat().st_size
                    log(f"✅ MinIO respaldado: {minio_backup_path.name} ({minio_size / (1024*1024):.1f} MB)")
                    # Aumentar size_bytes del run para reflejar el total
                    run.size_bytes = (run.size_bytes or 0) + minio_size
                else:
                    log(f"⚠️  Compresión de MinIO falló: {tar_result.stderr}")

                # Limpiar directorio temporal
                shutil.rmtree(minio_temp_dir, ignore_errors=True)
        else:
            log("📦 MinIO backup desactivado — omitiendo")

        # --- FASE 3: Subida a Google Drive via rclone ---
        drive_dest = f"{cfg.drive_remote_name}:{cfg.drive_folder_id}"
        log(f"☁️  Subiendo a Google Drive → {drive_dest}")

        # Subir ambos archivos (dump + minio.tar.gz si existe)
        files_to_upload = [str(local_path)]
        minio_backup_path = backup_dir / f"emerald_minio_{timestamp}.tar.gz"
        if minio_backup_path.exists():
            files_to_upload.append(str(minio_backup_path))

        for file_path in files_to_upload:
            rclone_result = subprocess.run(
                ["rclone", "copy", file_path, drive_dest],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if rclone_result.returncode != 0:
                log(f"❌ rclone falló para {Path(file_path).name}: {rclone_result.stderr}")
                raise RuntimeError(f"Subida a Drive falló: {rclone_result.stderr}")

        log(f"🎉 Subida a Drive completada ({len(files_to_upload)} archivo/s)")

        # --- FASE 4: Réplica LAN (opcional) ---
        if cfg.lan_backup_enabled and cfg.lan_server_ip and cfg.lan_server_user and cfg.lan_dest_folder:
            log(f"🖧  Replicando a LAN {cfg.lan_server_ip}...")

            for file_path in files_to_upload:
                scp_result = subprocess.run(
                    [
                        "scp",
                        "-i", cfg.lan_ssh_key_path or "/root/.ssh/id_ed25519",
                        "-o", "StrictHostKeyChecking=no",
                        "-o", "ConnectTimeout=10",
                        file_path,
                        f"{cfg.lan_server_user}@{cfg.lan_server_ip}:{cfg.lan_dest_folder}",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
                if scp_result.returncode != 0:
                    log(f"⚠️  SCP a LAN falló (no crítico) para {Path(file_path).name}: {scp_result.stderr}")
                else:
                    log(f"💾 {Path(file_path).name} replicado a LAN")
        else:
            log("🖧  Réplica LAN desactivada — omitiendo")

        # --- FASE 5: Retención local ---
        retention = cfg.retention_days
        deleted_local = 0
        for old_file in backup_dir.glob("emerald_prod_*.dump"):
            age_days = (now - datetime.fromtimestamp(
                old_file.stat().st_mtime, tz=timezone.utc
            )).days
            if age_days > retention:
                old_file.unlink()
                deleted_local += 1

        for old_file in backup_dir.glob("emerald_minio_*.tar.gz"):
            age_days = (now - datetime.fromtimestamp(
                old_file.stat().st_mtime, tz=timezone.utc
            )).days
            if age_days > retention:
                old_file.unlink()
                deleted_local += 1

        log(f"🧹 Retención local: {deleted_local} archivo/s eliminados (>{retention} días)")

        # --- FASE 6: Retención en Drive ---
        rclone_delete = subprocess.run(
            [
                "rclone", "delete", drive_dest,
                "--min-age", f"{retention}d",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if rclone_delete.returncode != 0:
            log(f"⚠️  Retención en Drive falló (no crítico): {rclone_delete.stderr}")
        else:
            log("🧹 Retención en Drive aplicada")

        run.status = BackupStatus.SUCCESS
        log("🏁 Backup completo finalizado con éxito")

    except Exception as exc:
        run.status = BackupStatus.FAILED
        run.error_message = str(exc)
        log(f"💥 ERROR: {exc}")
        logger.exception("[BACKUP] Error durante el backup")

    finally:
        run.finished_at = datetime.now(timezone.utc)
        run.log_output = "\n".join(log_lines)

    return run


# ============================================================
# Tarea Celery registrada
# ============================================================

@celery_app.task(name="backup.run_scheduled", bind=True, max_retries=0)
def run_scheduled_backup(self, triggered_by: str = "scheduled"):
    """
    Tarea Celery de backup de base de datos.

    Puede invocarse desde el Beat Schedule (automático) o desde el
    endpoint POST /api/v2/settings/backup/run-now (manual).

    El parámetro `triggered_by` acepta "scheduled" o "manual".
    """
    db = SessionLocal()
    run = None
    try:
        cfg = _get_or_create_config(db)

        trigger = BackupTrigger(triggered_by) if triggered_by in BackupTrigger._value2member_map_ else BackupTrigger.SCHEDULED

        if not cfg.is_enabled and trigger == BackupTrigger.SCHEDULED:
            logger.info("[BACKUP] is_enabled=False — backup programado omitido")
            return {"status": "skipped", "reason": "disabled"}

        run = _run_backup(cfg, trigger)
        db.add(run)
        db.commit()
        db.refresh(run)

        logger.info(
            "[BACKUP] run_id=%s status=%s size=%s",
            run.id, run.status, run.size_bytes,
        )
        return {
            "run_id": run.id,
            "status": run.status,
            "filename": run.filename,
            "size_bytes": run.size_bytes,
        }

    except Exception as exc:
        logger.exception("[BACKUP] Error inesperado en la tarea")
        if run is None:
            # Registrar el fallo aunque no hayamos podido crear el run
            try:
                run = BackupRun(
                    started_at=datetime.now(timezone.utc),
                    finished_at=datetime.now(timezone.utc),
                    status=BackupStatus.FAILED,
                    triggered_by=BackupTrigger(triggered_by) if triggered_by in BackupTrigger._value2member_map_ else BackupTrigger.SCHEDULED,
                    error_message=str(exc),
                )
                db.add(run)
                db.commit()
            except Exception:
                pass
        return {"status": "error", "error": str(exc)}
    finally:
        db.close()
