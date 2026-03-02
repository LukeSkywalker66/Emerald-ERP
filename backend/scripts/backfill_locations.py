#!/usr/bin/env python3
"""Backfill de localidades y barrios en conexiones."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_path))

from src.database import SessionLocal
from src.clients import ispcube
from src.models import Connection
from src.services.location_resolver import (
    resolve_address_data,
    get_or_create_city,
    get_or_create_neighborhood,
)


MAX_DETAIL_LOOKUPS = 50


def backfill_locations(dry_run: bool = False, max_detail_lookups: int = MAX_DETAIL_LOOKUPS) -> None:
    db = SessionLocal()
    try:
        conexiones_api = ispcube.obtener_todas_conexiones() or []
        clientes_api = ispcube.obtener_clientes() or []

        conn_map = {str(c.get("id")): c for c in conexiones_api if c.get("id")}
        client_map = {str(c.get("id")): c for c in clientes_api if c.get("id")}

        updated = 0
        skipped = 0
        detail_lookups = 0

        connections = db.query(Connection).all()
        for conn in connections:
            if conn.city_id and conn.neighborhood_id:
                skipped += 1
                continue

            conn_api = conn_map.get(str(conn.connection_id))
            if not conn_api:
                skipped += 1
                continue

            client_api = client_map.get(str(conn_api.get("customer_id")))
            resolved = resolve_address_data({"connection": conn_api, "client": client_api})

            if not resolved.get("neighborhood_name") and detail_lookups < max_detail_lookups:
                detail = ispcube.obtener_conexion_por_id(conn_api.get("id"))
                detail_lookups += 1
                if detail:
                    resolved = resolve_address_data({"connection": detail, "client": client_api})

            city = get_or_create_city(db, resolved.get("city_name"))
            neighborhood = get_or_create_neighborhood(
                db,
                resolved.get("neighborhood_name"),
                city.id if city else None,
            )

            if not city and not neighborhood:
                skipped += 1
                continue

            if not dry_run:
                conn.city_id = city.id if city else None
                conn.neighborhood_id = neighborhood.id if neighborhood else None
                db.flush()

            updated += 1

        if not dry_run:
            db.commit()

        print(
            "Backfill completo. "
            f"Actualizadas: {updated}. Omitidas: {skipped}. "
            f"Detalles consultados: {detail_lookups}."
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill de localidades/barrios en conexiones")
    parser.add_argument("--dry-run", action="store_true", help="No persiste cambios")
    parser.add_argument(
        "--max-detail",
        type=int,
        default=MAX_DETAIL_LOOKUPS,
        help="Maximo de consultas de detalle a ISPCube",
    )
    args = parser.parse_args()

    backfill_locations(dry_run=args.dry_run, max_detail_lookups=args.max_detail)
