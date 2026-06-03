# Auditoría de Almacenamiento de Archivos — Emerald ERP

**Fecha:** 31/05/2026  
**Alcance:** Análisis de lectura — sin modificación de código.

---

## 1. Ruta física exacta donde se guardan los archivos

```
<raíz del proyecto>/backend/media/tickets/{ticket_id}/{uuid}_{filename}
```

**Evidencia:**

| Fuente | Línea | Contenido |
|---|---|---|
| `backend/src/routers/tickets_v2_attachment.py` | L7 | `MEDIA_DIR = Path(__file__).parent.parent.parent / "media"` |

- `Path(__file__).parent.parent.parent` resuelve a `<raíz>/backend/` (sube desde `src/routers/` → `src/` → `backend/`).
- Concatena `"media"` → `backend/media/`.
- El directorio por ticket se crea en L77-78:
  ```python
  ticket_media_dir = MEDIA_DIR / "tickets" / str(ticket_id)
  ticket_media_dir.mkdir(parents=True, exist_ok=True)
  ```
- La ruta relativa guardada en BD (campo `filepath`) es: `tickets/{ticket_id}/{uuid}_{filename}`.
- La ruta absoluta dentro del contenedor Docker: `/app/media/tickets/{ticket_id}/...`.
- No existe una variable de entorno (`MEDIA_DIR`, `UPLOAD_PATH`, `STORAGE_PATH`) — la ruta está **hardcodeada**.

---

## 2. Mecanismo de persistencia según docker-compose

**Tipo: Bind Mount local → los archivos quedan mezclados con el código fuente.**

**Evidencia:**

| Fuente | Línea | Contenido |
|---|---|---|
| `docker-compose.yml` | L36-37 | `volumes:\n  - ./backend:/app` |
| `docker-compose.yml` | L148-149 | Solo existe `volumes:\n  postgres_data:` |

- El servicio `backend` **no** declara un volumen Docker nombrado para archivos. Usa `./backend:/app`, que es un **bind mount**: monta el directorio del host `./backend` dentro del contenedor en `/app`.
- Los archivos se escriben en `/app/media/tickets/...` dentro del contenedor, que equivale a `<proyecto>/backend/media/tickets/...` en el host.
- El servicio `celery_worker` (L125-126) también usa el mismo bind mount: `./backend:/app`.
- **No existe** un volumen Docker tipo `media_data:` o `uploads:` en el bloque `volumes:` global.
- La línea `COPY . .` en el `Dockerfile` (L10) copia todo al build, pero es irrelevante en runtime porque el bind mount lo pisa.

**Conclusión:** los archivos adjuntos **no** están en un volumen Docker aislado. Se almacenan directamente en el directorio `backend/media/` dentro del árbol de código fuente en el host.

---

## 3. Riesgos de cara a escalar a múltiples contenedores

| # | Riesgo | Severidad | Descripción |
|---|---|---|---|
| 1 | **Inconsistencia entre réplicas** | 🔴 Crítico | Cada contenedor backend tiene su propio filesystem vía bind mount. Si hay 3 réplicas, un upload en la réplica A no será visible para las réplicas B y C. Esto provoca 404 intermitentes al servir archivos. |
| 2 | **Pérdida de datos al rebuildear** | 🔴 Crítico | Los archivos están en `backend/media/` dentro del código fuente. Un `git clean`, `docker compose down -v`, o recreación del directorio puede eliminar todos los adjuntos históricos. |
| 3 | **Sin backup automatizado** | 🟠 Alto | PostgreSQL tiene volumen nombrado (`postgres_data`) y su backup correspondiente. El directorio `media/` no está respaldado por ningún mecanismo. Las referencias en BD quedan huérfanas si se pierde el filesystem. |
| 4 | **Incompatibilidad con balanceo de carga** | 🟠 Alto | Un load balancer con round-robin hará que solicitudes GET a `/media/...` fallen en ~2/3 de las réplicas. Se requeriría sticky sessions o un reverse proxy que sirva estáticos desde un volumen compartido. |
| 5 | **No compatible con orquestadores** | 🟠 Alto | Kubernetes, Docker Swarm, ECS o Nomad no pueden garantizar que el bind mount local exista en todos los nodos. El escalado horizontal se vuelve inviable sin reingeniería del storage. |
| 6 | **Acoplamiento storage ↔ código** | 🟡 Medio | Mezclar archivos de usuario con el código fuente viola el principio de separación de responsabilidades (12-Factor App). Dificulta deploys, rollbacks y CI/CD porque `media/` debe excluirse manualmente del versionado. |
| 7 | **Sin límite de espacio ni cuotas** | 🟡 Medio | No hay enforcement de capacidad del directorio. Un ataque de upload masivo o bug puede llenar el disco del host y tumbar todos los servicios. |

---

## Recomendaciones inmediatas (no vinculantes, solo para planificación)

1. **Crear un volumen Docker nombrado** (`emerald_media`) y montarlo en `/app/media` para el servicio `backend` y `celery_worker`.
2. **Externalizar la ruta** vía variable de entorno (`MEDIA_DIR`) en lugar de hardcodearla.
3. **Considerar object storage** (S3/MinIO) si se planea escalar más allá de un solo nodo.
4. **Agregar `media/` al `.gitignore` y a `.dockerignore`** para evitar que adjuntos terminen en el repositorio.
5. **Implementar backup del volumen `emerald_media`** con la misma frecuencia que el backup de PostgreSQL.