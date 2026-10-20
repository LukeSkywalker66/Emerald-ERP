# Sincronizar DESARROLLO con datos de PRODUCCIÓN

Guía para reemplazar la base PostgreSQL y los adjuntos MinIO de desarrollo con un
snapshot exacto de producción. Útil para analizar con datos reales.

## Requisitos

- Acceso SSH al host Debian de **producción** y al de **desarrollo**.
- Docker + Docker Compose en ambos.
- La imagen `alpine` (se descarga sola la primera vez, es mínima).

## Flujo (recomendado, byte-exacto)

### 1) Exportar en PRODUCCIÓN

En el host de producción:

```bash
cd /opt/emerald-dev   # o la ruta real del proyecto
./scripts/export_prod_snapshot.sh
```

Esto genera un único archivo, por ejemplo:

```
snapshots/emerald_prod_snapshot_20261020_123456.tar.gz
```

Contenido del paquete:

| Archivo          | Qué es                                        |
|------------------|-----------------------------------------------|
| `emerald.dump`   | Volcado PostgreSQL (formato custom `-Fc`)     |
| `minio_data.tar.gz` | Tar del volumen `/data` de MinIO (layout exacto) |
| `manifest.txt`   | Metadatos del snapshot                        |

> Recomendación: ejecutar en horario de bajo uso. `pg_dump` es consistente por
> sí solo; MinIO se tarrea en caliente (riesgo mínimo para un snapshot de dev).

### 2) Mover el archivo al servidor de desarrollo

```bash
# Desde producción:
scp snapshots/emerald_prod_snapshot_*.tar.gz USUARIO@IP_DESARROLLO:/opt/emerald-dev/snapshots/
```

### 3) Restaurar en DESARROLLO

En el host de desarrollo:

```bash
cd /opt/emerald-dev
./scripts/restore_dev_snapshot.sh snapshots/emerald_prod_snapshot_*.tar.gz
```

El script:

1. Pausa `backend` y `celery_worker`.
2. Restaura PostgreSQL (`pg_restore --clean --if-exists`) en `emerald_db_dev`.
3. Reemplaza el volumen `/data` de `emerald_minio_dev`.
4. Levanta todo el stack de desarrollo.

> ⚠️ Es destructivo: reemplaza por completo la BD y los adjuntos de desarrollo.

## Alternativa: circuito de la app + Google Drive

La app ya tiene backup automático (Settings → Backup → "Ejecutar ahora"), que
empaqueta PostgreSQL + MinIO y lo sube a Google Drive
(`Emerald_ERP_BackUps/production/`).

Para bajar ese backup a desarrollo existe [`scripts/disaster_recovery.sh`](scripts/disaster_recovery.sh:1):

```bash
./scripts/disaster_recovery.sh dev
```

**Consideraciones:**

- Siempre pasá el argumento `dev` (el default es `prod`).
- Descarga el último `*.tar.gz` de `production/` y restaura.
- **Limitación en MinIO**: ese script restaura los adjuntos con `docker cp` desde
  un sync de `rclone`, lo que **no reconstruye el layout interno (xl.meta) de un
  MinIO single-node**. Para adjuntos críticos conviene el flujo con `tar` de la
  sección anterior.
- Después de restaurar, conviene desactivar el backup automático en desarrollo
  (Settings → Backup → `is_enabled = false`) para que dev no genere backups a
  `Emerald_ERP_BackUps/development/` si no lo querés.

## Post-sincronización

- Revisar que el frontend de desarrollo apunte a la API correcta (`VITE_API_URL`).
- Verificar credenciales de login: al traer la BD de producción, los usuarios
  y contraseñas serán los de producción.
- Si dev debe quedar con backups apagados, ajustar `BackupConfig.is_enabled`.
