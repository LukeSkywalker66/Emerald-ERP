"""
Resolver for ISPCube location data (city/neighborhood).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models.locations import City, Neighborhood


@dataclass
class ResolvedAddress:
    city_name: Optional[str]
    neighborhood_name: Optional[str]
    source: str
    needs_review: bool = False


def _normalize_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = " ".join(value.strip().split())
    return cleaned if cleaned else None


def _extract_city_name(raw_value) -> Optional[str]:
    if isinstance(raw_value, dict):
        return _normalize_name(raw_value.get("name"))
    return _normalize_name(raw_value)


def resolve_address_data(ispcube_data: dict) -> dict:
    connection = ispcube_data.get("connection") or {}
    client = ispcube_data.get("client") or ispcube_data.get("cliente") or {}

    city_name = _extract_city_name(
        connection.get("localidad")
        or connection.get("city")
        or client.get("localidad")
        or client.get("city")
    )

    neighborhood_name = _normalize_name(
        connection.get("barrio")
        or connection.get("neighborhood")
        or client.get("barrio")
        or client.get("neighborhood")
    )

    if city_name or neighborhood_name:
        return ResolvedAddress(
            city_name=city_name,
            neighborhood_name=neighborhood_name,
            source="structured",
            needs_review=False,
        ).__dict__

    address = _normalize_name(
        client.get("address")
        or client.get("billing_address")
        or connection.get("direccion")
        or connection.get("address")
    )
    if address and "," in address:
        parts = [p.strip() for p in address.split(",") if p.strip()]
        inferred_city = parts[-1] if len(parts) >= 1 else None
        inferred_neighborhood = parts[0] if len(parts) >= 2 else None
        return ResolvedAddress(
            city_name=inferred_city,
            neighborhood_name=inferred_neighborhood,
            source="parsed",
            needs_review=True,
        ).__dict__

    return ResolvedAddress(
        city_name=None,
        neighborhood_name=None,
        source="empty",
        needs_review=True,
    ).__dict__


def get_or_create_city(db: Session, name: Optional[str], zone_id: Optional[int] = None) -> Optional[City]:
    if not name:
        return None
    stmt = select(City).where(func.lower(City.name) == name.lower())
    city = db.execute(stmt).scalar_one_or_none()
    if city:
        return city
    city = City(name=name, zone_id=zone_id)
    db.add(city)
    db.flush()
    return city


def get_or_create_neighborhood(
    db: Session, name: Optional[str], city_id: Optional[int]
) -> Optional[Neighborhood]:
    if not name or not city_id:
        return None
    stmt = select(Neighborhood).where(
        Neighborhood.city_id == city_id,
        func.lower(Neighborhood.name) == name.lower(),
    )
    neighborhood = db.execute(stmt).scalar_one_or_none()
    if neighborhood:
        return neighborhood
    neighborhood = Neighborhood(name=name, city_id=city_id)
    db.add(neighborhood)
    db.flush()
    return neighborhood
