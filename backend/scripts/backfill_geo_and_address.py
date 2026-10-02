#!/usr/bin/env python3
"""Backfill de geolocalización y campos de dirección desde ISPCube.

Corrige datos ya cargados:
- Coordenadas: re-normaliza lat/lng desde ISPCube (antes no se importaban o se
  guardaban con precisión insuficiente `Numeric(10, 8)`). Ahora se guardan en
  `Numeric(15, 12)` sin redondeo.
- address_parts: puebla el JSONB con todos los campos de dirección disponibles.

Reglas:
- Si ISPCube entrega coordenadas válidas, se pisan las actuales (incluso si la
  actual es `0` placeholder o fue redondeada).
- Si ISPCube no entrega coordenadas, se conserva el valor existente (nunca se
  escribe NULL encima de un dato bueno).
- `address_parts` se actualiza siempre que se compute contenido.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_path))

from src.database import SessionLocal
from src.clients import ispcube
from src.models import Connection
from src.services.geo_normalizer import extract_lat_lng, extract_address_parts


def backfill(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        conexiones_api = ispcube.obtener_todas_conexiones() or []
        clientes_api = ispcube.obtener_clientes() or []

        conn_map = {str(c.get("id")): c for c in conexiones_api if c.get("id")}
        client_map = {str(c.get("id")): c for c in clientes_api if c.get("id")}

        updated_coords = 0
        updated_address = 0
        skipped = 0

        connections = db.query(Connection).all()
        for conn in connections:
            conn_api = conn_map.get(str(conn.connection_id))
            if not conn_api:
                skipped += 1
                continue

            client_api = client_map.get(str(conn_api.get("customer_id")))
            lat, lng = extract_lat_lng(conn_api, client_api)
            address_parts = extract_address_parts(conn_api, client_api)

            # Coordenadas: normalizar si ISPCube trae dato válido.
            if lat is not None and lng is not None:
                if not dry_run:
                    conn.latitude = lat
                    conn.longitude = lng
                updated_coords += 1

            # Dirección: actualizar siempre que haya contenido.
            if address_parts:
                if not dry_run:
                    conn.address_parts = address_parts
                updated_address += 1

        if not dry_run:
            db.commit()

        print(
            "Backfill geo/address completo. "
            f"Coordenadas actualizadas: {updated_coords}. "
            f"Direcciones actualizadas: {updated_address}. "
            f"Sin datos ISPCube: {skipped}."
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill de geolocalización y dirección desde ISPCube")
    parser.add_argument("--dry-run", action="store_true", help="No persiste cambios")
    args = parser.parse_args()

    backfill(dry_run=args.dry_run)
