# CONTEXTO NEXT SESSION - Localidades/Barrios (ISPCube)

Fecha: 2026-02-10
Rama: develop

## Objetivo
Persistir localidad y barrio desde ISPCube para que el frontend de Coordinacion pueda agrupar por barrio/localidad y acceder a `ticket.connection.neighborhood.name`.

## Estado actual
- Se implementaron modelos City/Neighborhood y se extendio Connection con city_id/neighborhood_id.
- Se agrego resolver con jerarquia de extraccion (conexion -> cliente -> parsing basico).
- Se actualizo el sync nocturno de conexiones para persistir city/neighborhood.
- Se creo script de backfill con limite de consultas de detalle.
- Se genero migracion y merge de heads, y se aplico `alembic upgrade head` en Docker.
- Backfill: city_id completo en 7001/7090 conexiones; neighborhood_id quedo en 0 (no vino barrio en endpoints listados).

## Archivos clave
- backend/src/models/locations.py
- backend/src/models/beholder.py
- backend/src/models/tickets.py
- backend/src/services/location_resolver.py
- backend/src/jobs/sync.py
- backend/src/clients/ispcube.py (nuevo helper obtener_conexion_por_id)
- backend/scripts/backfill_locations.py
- backend/alembic/versions/2026_02_09_001_add_locations_city_neighborhoods.py
- backend/alembic/versions/0f8c172a0f1e_merge_heads.py
- docs/LOCATION_SYNC_REPORT_2026-02-10.md

## Migraciones
- Heads anteriores se mergearon.
- Nuevo head: 0f8c172a0f1e (merge).

## Backfill (Docker)
- Dry-run:
  docker compose exec backend python scripts/backfill_locations.py --dry-run
- Real:
  docker compose exec backend python scripts/backfill_locations.py
- Limite de detalle:
  docker compose exec backend python scripts/backfill_locations.py --max-detail 50

## Detalle ISPCube
- customers_list devuelve city (objeto con name), no barrio.
- connections_list no trae barrio.
- Se agrego consulta detalle /api/connection por connection_id (limitada) para buscar barrio.

## Resultados DB (query)
- Con city_id: 7001 / 7090
- Con neighborhood_id: 0
- cities: 13, neighborhoods: 0

## Pendientes
1) Verificar si /api/connection devuelve barrio/neighborhood y ajustar el nombre del campo si difiere.
2) Re-ejecutar backfill con --max-detail mayor en ventana controlada (evitar spam a ISPCube).
3) Validar que frontend muestre barrio cuando exista.

## Notas
- Se agrego relacion soft Ticket.connection para acceder a Connection sin FK estricta.
- Certbot: hubo un cambio automatico en data/certbot/conf/renewal/emerald.2finternet.ar.conf (timestamp). Se incluyo en commit.

## Commits
- feat: agregar localidades y barrios en sync
- Merge Alembic heads
