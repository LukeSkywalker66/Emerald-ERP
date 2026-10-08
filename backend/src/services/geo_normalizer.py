"""Geo & address normalization for ISPCube location data.

Single source of truth to parse latitude/longitude and address metadata coming
from ISPCube (nightly sync + online lookup). Every ingestion point must use
this module so the whole codebase shares one solid, functional format.

Contract:
- Coordinates are stored as `Numeric(15, 12)` (exact, NO rounding of the value
  received from ISPCube). `Numeric(15, 12)` fits latitude up to +/-90 and
  longitude up to +/-180 with 12 decimal places (ISPCube sends up to 12).
- In transit / APIs we expose `float` (display) but the DB keeps the Decimal.
- Null-safe: these helpers NEVER raise. Unparseable / invalid / absent values
  return `None` (SQL NULL), so a bad location never breaks a transaction.
"""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, Optional, Tuple

from src.config import logger

# ISPCube sends lat/lng with up to 12 decimal places.
MAX_DECIMAL_PLACES = 12
_QUANT = Decimal(1).scaleb(-MAX_DECIMAL_PLACES)

LAT_MAX = Decimal("90")
LNG_MAX = Decimal("180")

# DMS formats:
#   31° 58' 25.6" S
#   31 58 25.6 S
#   31°58'25.6"S
_DMS_RE = re.compile(
    r"(-?\d{1,3})\s*[°d]\s*(\d{1,2})\s*['′m]\s*(\d{1,2}(?:\.\d+)?)\s*[\"″s]?\s*([NSEWnsew])?"
)

# Google Maps URL coordinate patterns (same family used in routers/utils.py).
_MAPS_PAIR_RE = re.compile(r"@?(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)")
_MAPS_Q_RE = re.compile(r"[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)")
_MAPS_PLACE_RE = re.compile(r"/place/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)")

LAT_KEYS = ("lat", "latitude", "latitud", "gps_lat")
LNG_KEYS = ("lng", "longitude", "longitud", "gps_lng")
PAIR_KEYS = ("location", "coordinates", "coordenadas", "gps", "position", "geo", "map", "map_location")


def _as_string(value: Any) -> Optional[str]:
    """Best-effort conversion to a clean string; None for non-scalar junk."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, dict):
        return None
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    text = str(value).strip()
    return text or None


def _quantize(value: Decimal) -> Decimal:
    """Limit decimal places to MAX_DECIMAL_PLACES (no change for ISPCube data)."""
    if value == value.to_integral_value():
        return value
    try:
        return value.quantize(_QUANT, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return value


def _parse_dms(value: Any) -> Optional[Decimal]:
    text = _as_string(value)
    if not text:
        return None
    match = _DMS_RE.search(text)
    if not match:
        return None
    try:
        degrees = Decimal(match.group(1))
        minutes = Decimal(match.group(2))
        seconds = Decimal(match.group(3))
        hemisphere = (match.group(4) or "").upper()
    except (InvalidOperation, ValueError):
        return None
    result = abs(degrees) + minutes / Decimal(60) + seconds / Decimal(3600)
    if hemisphere in ("S", "W") or degrees < 0:
        result = -result
    return _quantize(result)


def _parse_decimal(value: Any) -> Optional[Decimal]:
    text = _as_string(value)
    if not text:
        return None
    dms = _parse_dms(text)
    if dms is not None:
        return dms
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return None


def _split_pair(value: Any) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """Parse a combined value that may contain both coordinates."""
    if isinstance(value, dict):
        for lat_key, lng_key in (("lat", "lng"), ("latitude", "longitude"), ("latitud", "longitud")):
            lat = _parse_decimal(value.get(lat_key))
            lng = _parse_decimal(value.get(lng_key))
            if lat is not None and lng is not None:
                return lat, lng
        return None, None

    text = _as_string(value)
    if not text:
        return None, None

    # URL -> lat,lng
    for pattern in (_MAPS_PAIR_RE, _MAPS_Q_RE, _MAPS_PLACE_RE):
        match = pattern.search(text)
        if match:
            try:
                return Decimal(match.group(1)), Decimal(match.group(2))
            except InvalidOperation:
                return None, None

    # "lat,lng" / "lat lng" / "lat;lng"
    if re.search(r"[-+]?\d+\.?\d*\s*[,;\s]\s*[-+]?\d+\.?\d*", text):
        parts = re.split(r"[,;]+|\s+", text)
        parts = [p for p in parts if p.strip()]
        if len(parts) >= 2:
            first = _parse_decimal(parts[0])
            second = _parse_decimal(parts[1])
            if first is not None and second is not None:
                return first, second

    return None, None


def _validate(lat: Optional[Decimal], lng: Optional[Decimal]) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    if lat is not None and (abs(lat) > LAT_MAX):
        logger.warning("[geo] latitud fuera de rango descartada: %s", lat)
        lat = None
    if lng is not None and (abs(lng) > LNG_MAX):
        logger.warning("[geo] longitud fuera de rango descartada: %s", lng)
        lng = None
    # ISPCube uses 0.000000000000 as "sin geolocalización".
    if lat is not None and lng is not None and lat == 0 and lng == 0:
        return None, None
    return lat, lng


def extract_lat_lng(
    connection: Optional[Dict[str, Any]],
    customer: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """Extract (latitude, longitude) as Decimal from ISPCube payloads.

    Priority:
      1. separated lat/lng fields of the connection
      2. separated lat/lng fields of the customer
      3. combined fields (location/coordinates/...) of the connection
      4. combined fields of the customer
      5. a `lat` field of the connection that actually contains "lat,lng"

    Returns (None, None) when there is no usable location. Never raises.
    """
    connection = connection or {}
    customer = customer or {}

    def _valid_pair(lat: Optional[Decimal], lng: Optional[Decimal]) -> Tuple[Optional[Decimal], Optional[Decimal]]:
        if lat is None or lng is None:
            return None, None
        return _validate(_quantize(lat), _quantize(lng))

    # 1-2. Separated fields (lat/lng, latitude/longitude, ...).
    # Si parsean a (0, 0) placeholder, no se retorna: se sigue buscando en los
    # campos combinados porque puede haber un `location` con el dato real.
    for source in (connection, customer):
        for lat_key, lng_key in zip(LAT_KEYS, LNG_KEYS):
            lat, lng = _valid_pair(_parse_decimal(source.get(lat_key)), _parse_decimal(source.get(lng_key)))
            if lat is not None and lng is not None:
                return lat, lng
        # también aceptar el par dentro de un único campo `lat`
        if isinstance(source.get("lat"), str) and re.search(r"[,;\s]", source["lat"]):
            lat, lng = _valid_pair(*_split_pair(source.get("lat")))
            if lat is not None and lng is not None:
                return lat, lng

    # 3-4. Campos combinados (location/coordinates/...).
    for source in (connection, customer):
        for key in PAIR_KEYS:
            raw = source.get(key)
            if raw is None:
                continue
            lat, lng = _valid_pair(*_split_pair(raw))
            if lat is not None and lng is not None:
                return lat, lng

    return None, None


def _non_empty(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (dict, list, tuple)):
        return bool(value)
    return True


def _city_dict(value: Any) -> Optional[Dict[str, Any]]:
    if isinstance(value, dict):
        data = {
            "name": value.get("name"),
            "province": value.get("province"),
            "postal_code": value.get("postal_code"),
        }
        if any(_non_empty(v) for v in data.values()):
            return data
    return None


def extract_address_parts(
    connection: Optional[Dict[str, Any]],
    customer: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Probe every address-related field available in the ISPCube payload.

    The source data is irregular, so instead of forcing a single field we keep
    ALL the fields that have real data. The frontend renders whatever keys are
    present (street, cross streets, neighborhood, city, province, postal code,
    extras). Returns {} when nothing usable is found. Never raises.
    """
    connection = connection or {}
    customer = customer or {}

    raw = {
        "connection_address": connection.get("address"),
        "connection_direccion": connection.get("direccion"),
        "connection_localidad": connection.get("localidad"),
        "connection_barrio": connection.get("barrio"),
        "connection_neighborhood": connection.get("neighborhood"),
        "connection_city": connection.get("city"),
        "connection_city_id": connection.get("city_id"),
        "customer_address": customer.get("address"),
        "customer_tax_residence": customer.get("tax_residence"),
        "customer_between_address1": customer.get("between_address1"),
        "customer_between_address2": customer.get("between_address2"),
        "customer_extra1": customer.get("extra1"),
        "customer_extra2": customer.get("extra2"),
        "customer_city": customer.get("city"),
        "customer_city_id": customer.get("city_id"),
        "customer_localidad": customer.get("localidad"),
        "customer_barrio": customer.get("barrio"),
        "customer_neighborhood": customer.get("neighborhood"),
    }

    street = next(
        (raw[k] for k in ("connection_address", "connection_direccion", "customer_address") if _non_empty(raw[k])),
        None,
    )
    neighborhood = next(
        (
            raw[k]
            for k in (
                "connection_barrio",
                "connection_neighborhood",
                "connection_localidad",
                "customer_barrio",
                "customer_neighborhood",
                "customer_localidad",
            )
            if _non_empty(raw[k])
        ),
        None,
    )
    city_obj = _city_dict(raw["connection_city"]) or _city_dict(raw["customer_city"])

    cross_streets = [
        s for s in (raw["customer_between_address1"], raw["customer_between_address2"]) if _non_empty(s)
    ]
    extras = [s for s in (raw["customer_extra1"], raw["customer_extra2"]) if _non_empty(s)]
    city_id = raw["connection_city_id"] if _non_empty(raw["connection_city_id"]) else raw["customer_city_id"]

    parts: Dict[str, Any] = {}
    if _non_empty(street):
        parts["street"] = street.strip() if isinstance(street, str) else street
    if cross_streets:
        parts["cross_streets"] = cross_streets
    if _non_empty(raw["customer_tax_residence"]):
        parts["tax_residence"] = raw["customer_tax_residence"]
    if neighborhood:
        parts["neighborhood"] = neighborhood
    if city_obj:
        parts["city"] = city_obj
    if _non_empty(city_id):
        parts["city_id"] = city_id
    if extras:
        parts["extra"] = extras

    # Keep raw fields (non-empty only) for audit / future use.
    raw_clean = {k: v for k, v in raw.items() if _non_empty(v)}
    if raw_clean:
        parts["raw"] = raw_clean

    return parts


def json_safe(value: Any) -> Any:
    """Make a structure JSONB-serializable (Decimal -> str)."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    return value
