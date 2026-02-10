# Reporte - Localidades y Barrios (Sync ISPCube)

Fecha: 2026-02-10

## Objetivo
Persistir localidad y barrio desde ISPCube para que el frontend de Coordinacion pueda agrupar por barrio/localidad y acceder a `ticket.connection.neighborhood.name`.

## Cambios realizados

### Modelos y relaciones
- Se agregaron modelos `City` y `Neighborhood`.
- Se extendio `Connection` con `city_id` y `neighborhood_id`.
- Se agrego relacion soft `Ticket.connection` (sin FK estricta) para acceder a la conexion desde tickets.

Archivos:
- backend/src/models/locations.py
- backend/src/models/beholder.py
- backend/src/models/tickets.py
- backend/src/models/__init__.py

### Resolver de ubicacion
- Se creo `resolve_address_data()` con jerarquia:
  1) Campos estructurados en conexion (`localidad`, `city`, `barrio`, `neighborhood`).
  2) Campos en cliente (`city`, `barrio`).
  3) Parsing basico de `address`.
- Se agregaron helpers `get_or_create_city()` y `get_or_create_neighborhood()`.

Archivo:
- backend/src/services/location_resolver.py

### Sync ISPCube
- En `sync_connections()` se resuelve ciudad/barrio y se guarda en `connections`.
- Se usa cache en memoria para evitar duplicados y queries innecesarias.

Archivo:
- backend/src/jobs/sync.py

### Backfill historico
- Script `backfill_locations.py` recorre conexiones y completa `city_id` y `neighborhood_id`.
- Se agrego consulta de detalle `/api/connection` para intentar obtener barrio.
- Se limita a `MAX_DETAIL_LOOKUPS=50` por defecto para evitar spam.
- Flag `--max-detail` para ajustar el limite.

Archivo:
- backend/scripts/backfill_locations.py

### Alembic
- Migracion de tablas `cities` y `neighborhoods` + FKs en `connections`.
- Se genero merge revision de heads.

Archivos:
- backend/alembic/versions/2026_02_09_001_add_locations_city_neighborhoods.py
- backend/alembic/versions/0f8c172a0f1e_merge_heads.py

## Estado de migraciones
- Se aplico `alembic upgrade head` dentro de Docker.
- Se detectaron multiples heads y se genero merge revision.

## Resultados de backfill
- Conexiones con `city_id`: 7001 / 7090.
- Conexiones con `neighborhood_id`: 0 / 7090.
- Ciudades creadas: 13.
- Barrios creados: 0.

Observacion: ISPCube retorna `city` en clientes, pero no se encontraron barrios en los endpoints usados. Se agrego consulta de detalle con limite para intentar completar barrios en pruebas.

## Comandos usados (Docker)
- Migraciones:
  - docker compose exec backend alembic upgrade head
- Backfill:
  - docker compose exec backend python scripts/backfill_locations.py --dry-run
  - docker compose exec backend python scripts/backfill_locations.py

## Pendientes / Proximos pasos
1) Confirmar si el detalle `/api/connection` contiene campos `barrio` o `neighborhood` y ajustar el resolver si el nombre del campo difiere.
2) Si ISPCube provee barrio en detalle, aumentar `--max-detail` en una ventana controlada (ej: 200) y rerun del backfill.
3) Agregar validaciones en frontend para mostrar barrio cuando exista.
4) Revisar estrategia de cache si se habilita backfill masivo.
