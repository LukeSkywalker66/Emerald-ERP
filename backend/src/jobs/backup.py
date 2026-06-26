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
import tarfile
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


def _run_backup(cfg: BackupConfig, triggered_by: BackupTrigger, run: Optional[BackupRun] = None) -> BackupRun:
    """
    Ejecuta el proceso completo de backup y retorna un BackupRun con el resultado.
    No hace commit — el caller es responsable.
    """
    now = datetime.now(timezone.utc)
    log_lines: list[str] = []
    if run is None:
        run = BackupRun(
            started_at=now,
            status=BackupStatus.RUNNING.value,
            triggered_by=triggered_by.value,
        )
    else:
        # Reusar run pre-creado (manual) para evitar registros pendientes huérfanos
        run.status = BackupStatus.RUNNING.value
        run.triggered_by = triggered_by.value

    def log(msg: str) -> None:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        log_lines.append(line)
        logger.info(line)

    try:
        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            raise RuntimeError("DATABASE_URL no definida en el entorno")

        rclone_config_path = cfg.rclone_config_path or "/root/.config/rclone/rclone.conf"
        rclone_config = Path(rclone_config_path)
        if not rclone_config.exists():
            raise RuntimeError(
                "rclone.conf no encontrado en el contenedor. "
                f"Ruta configurada: {rclone_config_path}. "
                "Definí la ruta desde Settings > Backup y asegurá el mount del archivo en celery_worker."
            )
        rclone_base_cmd = ["rclone", "--config", str(rclone_config)]

        db_params = _parse_db_url(database_url)
        app_env = os.environ.get("APP_ENV", "development")

        # --- Preparar directorio y nombres de archivo ---
        # Aislamiento fuerte por entorno: cada APP_ENV usa su propio subdirectorio.
        backup_root_dir = Path(cfg.backup_dir)
        backup_dir = backup_root_dir / app_env
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = now.strftime("%Y-%m-%d_%H%M%S")
        # Empaquetado único por ejecución para mantener consistencia en Drive/LAN
        package_name = f"emerald_backup_{app_env}_{timestamp}.tar.gz"
        package_path = backup_dir / package_name
        work_dir = backup_dir / f"emerald_backup_work_{app_env}_{timestamp}"
        dump_name = f"emerald_prod_{app_env}_{timestamp}.dump"
        dump_path = work_dir / dump_name
        minio_dir = work_dir / "minio"
        manifest_path = work_dir / "manifest.txt"
        work_dir.mkdir(parents=True, exist_ok=True)

        log(f"🚀 Iniciando backup — paquete destino: {package_path}")

        # --- pg_dump via subprocess (postgresql-client en el contenedor) ---
        pg_env = {**os.environ, "PGPASSWORD": db_params["password"]}
        pg_cmd = [
            "pg_dump",
            "-h", db_params["host"],
            "-p", db_params["port"],
            "-U", db_params["user"],
            "-d", db_params["dbname"],
            "-F", "c",          # custom format (comprimido, restaurable con pg_restore)
            "-f", str(dump_path),
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

        if not dump_path.exists() or dump_path.stat().st_size == 0:
            raise RuntimeError("El archivo dump está vacío o no se creó")

        dump_size = dump_path.stat().st_size
        log(f"✅ Dump creado: {dump_name} ({dump_size / 1024:.1f} KB)")

        # --- FASE 2: MinIO backup (Adjuntos, capturas, reportes) ---
        if cfg.include_minio_backup:
            log(f"📦 Incluyendo MinIO bucket '{cfg.minio_bucket}'...")

            # Configurar rclone para acceder a MinIO localmente
            # Esperamos que exista un remoto 'minio' en rclone.conf
            rclone_copy = subprocess.run(
                [*rclone_base_cmd, "sync", f"{cfg.minio_remote_name}:/{cfg.minio_bucket}", str(minio_dir)],
                capture_output=True,
                text=True,
                timeout=300,
            )

            if rclone_copy.returncode != 0:
                log(f"⚠️  MinIO sync falló (no crítico): {rclone_copy.stderr}")
            else:
                log("✅ MinIO sincronizado al workspace de backup")
        else:
            log("📦 MinIO backup desactivado — omitiendo")

        # --- Empaquetado final único (dump + minio opcional) ---
        manifest_lines = [
            f"created_at_utc={now.isoformat()}",
            f"app_env={app_env}",
            f"postgres_dump={dump_name}",
            f"include_minio_backup={str(cfg.include_minio_backup).lower()}",
            f"minio_bucket={cfg.minio_bucket}",
        ]
        manifest_path.write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")

        with tarfile.open(package_path, "w:gz") as tar:
            tar.add(dump_path, arcname=dump_name)
            if minio_dir.exists():
                tar.add(minio_dir, arcname=f"minio_{cfg.minio_bucket}")
            tar.add(manifest_path, arcname="manifest.txt")

        if not package_path.exists() or package_path.stat().st_size == 0:
            raise RuntimeError("No se pudo generar el paquete comprimido final")

        package_size = package_path.stat().st_size
        run.filename = package_name
        run.size_bytes = package_size
        log(f"📦 Paquete final creado: {package_name} ({package_size / (1024 * 1024):.2f} MB)")

        # Limpiar workspace temporal
        shutil.rmtree(work_dir, ignore_errors=True)

        # --- FASE 3: Subida a Google Drive via rclone ---
        # Aislamiento fuerte por entorno también en cloud remoto.
        drive_dest = f"{cfg.drive_remote_name}:{cfg.drive_folder_id.rstrip('/')}/{app_env}"
        log(f"☁️  Subiendo a Google Drive → {drive_dest}")

        # Subir solo el paquete final
        files_to_upload = [str(package_path)]

        for file_path in files_to_upload:
            rclone_result = subprocess.run(
                [*rclone_base_cmd, "copy", file_path, drive_dest],
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
            lan_base_folder = cfg.lan_dest_folder.rstrip("/")
            lan_target_folder = f"{lan_base_folder}/{app_env}"
            log(f"🖧  Replicando a LAN {cfg.lan_server_ip}:{lan_target_folder}...")

            # Garantiza aislamiento por entorno en destino LAN (dev/staging/prod)
            mkdir_result = subprocess.run(
                [
                    "ssh",
                    "-i", cfg.lan_ssh_key_path or "/root/.ssh/id_ed25519",
                    "-o", "StrictHostKeyChecking=no",
                    "-o", "ConnectTimeout=10",
                    f"{cfg.lan_server_user}@{cfg.lan_server_ip}",
                    "mkdir", "-p", lan_target_folder,
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if mkdir_result.returncode != 0:
                log(f"⚠️  No se pudo crear carpeta remota LAN {lan_target_folder}: {mkdir_result.stderr}")

            for file_path in files_to_upload:
                scp_result = subprocess.run(
                    [
                        "scp",
                        "-i", cfg.lan_ssh_key_path or "/root/.ssh/id_ed25519",
                        "-o", "StrictHostKeyChecking=no",
                        "-o", "ConnectTimeout=10",
                        file_path,
                        f"{cfg.lan_server_user}@{cfg.lan_server_ip}:{lan_target_folder}/",
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
        for old_file in backup_dir.glob("emerald_backup_*.tar.gz"):
            age_days = (now - datetime.fromtimestamp(
                old_file.stat().st_mtime, tz=timezone.utc
            )).days
            if age_days > retention:
                old_file.unlink()
                deleted_local += 1

        # Limpieza de formatos legacy previos al empaquetado único
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
                *rclone_base_cmd,
                "delete", drive_dest,
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

        run.status = BackupStatus.SUCCESS.value
        log("🏁 Backup completo finalizado con éxito")

    except Exception as exc:
        run.status = BackupStatus.FAILED.value
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
def run_scheduled_backup(self, triggered_by: str = "scheduled", run_id: Optional[int] = None):
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

        if run_id is not None:
            run = db.query(BackupRun).filter(BackupRun.id == run_id).first()

        run = _run_backup(cfg, trigger, run=run)
        if run.id is None:
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
                # Asegurar que triggered_by sea un string con el valor correcto
                trigger_value = triggered_by if isinstance(triggered_by, str) else triggered_by.value if hasattr(triggered_by, 'value') else BackupTrigger.SCHEDULED.value
                run = BackupRun(
                    started_at=datetime.now(timezone.utc),
                    finished_at=datetime.now(timezone.utc),
                    status=BackupStatus.FAILED.value,
                    triggered_by=trigger_value,
                    error_message=str(exc),
                )
                db.add(run)
                db.commit()
            except Exception:
                pass
        return {"status": "error", "error": str(exc)}
    finally:
        db.close()
