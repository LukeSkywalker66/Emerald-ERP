#!/usr/bin/env python3
"""Analisis de patrones de direcciones para extraer barrio."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable, Optional

from sqlalchemy import select

backend_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_path))

from src.database import SessionLocal
from src.models import Connection


PATTERNS = [
    ("Patron 1", re.compile(r"(?i)barrio\s*:?\s*(.*?)(?:$|-)", re.IGNORECASE)),
    ("Patron 2", re.compile(r"(?i)b°\s*(.*?)(?:$|-)", re.IGNORECASE)),
    ("Patron 3", re.compile(r"(?i)\((.*?)\)")),
]


def _extract_neighborhood(address: str) -> Optional[tuple[str, str]]:
    for label, pattern in PATTERNS:
        match = pattern.search(address)
        if match:
            value = (match.group(1) or "").strip()
            if value:
                return label, value
    return None


def _fetch_sample_addresses(limit: int = 100) -> Iterable[str]:
    stmt = (
        select(Connection.direccion)
        .where(Connection.direccion.is_not(None))
        .limit(limit)
    )
    with SessionLocal() as db:
        rows = db.execute(stmt).scalars().all()
    return [r for r in rows if r]


def main() -> None:
    addresses = _fetch_sample_addresses(1000)

    print("Analisis de Direcciones (muestra=1000)")
    print("=" * 80)

    no_match = []
    for address in addresses:
        result = _extract_neighborhood(address)
        if result:
            label, neighborhood = result
            print(f"Direccion Original: {address}")
            print(f"-> Posible Barrio Detectado ({label}): {neighborhood}")
            print("-" * 80)
        else:
            no_match.append(address)

    print("\nDirecciones sin match:")
    print("=" * 80)
    for address in no_match:
        print(f"- {address}")


if __name__ == "__main__":
    main()
