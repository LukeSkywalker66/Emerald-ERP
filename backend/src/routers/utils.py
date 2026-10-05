"""Router de utilidades — parse-map-link para geolocalización."""
import re
from urllib.parse import urlparse, parse_qs
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx

router = APIRouter(tags=["Utilities"])


class ParseMapLinkRequest(BaseModel):
    """Payload con la URL de Google Maps a resolver."""
    url: HttpUrl


class ParseMapLinkResponse(BaseModel):
    """Coordenadas extraídas del link."""
    latitude: float
    longitude: float


async def _resolve_redirects(url: str) -> tuple[str, str]:
    """Sigue redirects de un link acortado y devuelve (final_url, html_body)."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
            return str(resp.url), resp.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Tiempo de espera agotado al resolver la URL")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al resolver URL: {str(e)}")


_LAT_LNG_RE = re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)")
# Par de coordenadas con separador tolerante: "," ";" espacio y el "+" que Google
# agrega en los links de "pin soltado" (ej: /maps/search/-31.94,+-65.17).
_PAIR_RE = re.compile(r"(-?\d+\.\d+)\s*[,;]\s*\+?(-?\d+\.\d+)")
_D3D4_RE = re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)")


def _valid_pair(lat: float, lng: float) -> bool:
    """Valida rangos reales de latitud/longitud."""
    return -90 <= lat <= 90 and -180 <= lng <= 180


def _to_pair(match) -> tuple[float, float] | None:
    """Convierte un match (group(1)=lat, group(2)=lng) a (lat, lng) validado."""
    try:
        lat, lng = float(match.group(1)), float(match.group(2))
    except (TypeError, ValueError, AttributeError):
        return None
    if _valid_pair(lat, lng):
        return lat, lng
    return None


def _try_extract_from_url(url: str) -> tuple[float, float] | None:
    """Extrae coordenadas de la URL final priorizando fuentes de mayor precisión.

    Fuentes cubiertas (de más a menos exacto):
      1. `geo:lat,lng` (URI).
      2. `/maps/dir/...` → destino (último par del path).
      3. `!3d{lat}!4d{lng}` → pin exacto del lugar / destino de direcciones.
      4. Query params: center, ll, q, query, daddr, destination, saddr.
      5. `/maps/search/{lat},{+}{lng}` → pin soltado (share desde celular).
      6. `/maps/place/...@lat,lng`.
      7. `@lat,lng` → centro del viewport (último recurso, menos exacto).
    """
    # 1) geo: URI
    m = re.search(r"geo:(-?\d+\.\d+),(-?\d+\.\d+)", url)
    if m:
        r = _to_pair(m)
        if r:
            return r

    # 2) /maps/dir/ → el destino es el último par de coordenadas del path.
    m = re.search(r"/maps/dir/([^@?]*)", url)
    if m:
        pairs = _PAIR_RE.findall(m.group(1))
        if pairs:
            lat_s, lng_s = pairs[-1]
            try:
                lat, lng = float(lat_s), float(lng_s)
            except ValueError:
                lat = lng = None
            if lat is not None and _valid_pair(lat, lng):
                return lat, lng

    # 3) !3d{lat}!4d{lng} — última ocurrencia (única en place, destino en dir).
    d3d4 = _D3D4_RE.findall(url)
    if d3d4:
        lat_s, lng_s = d3d4[-1]
        try:
            lat, lng = float(lat_s), float(lng_s)
        except ValueError:
            lat = lng = None
        if lat is not None and _valid_pair(lat, lng):
            return lat, lng

    # 4) Query params explícitos (parse_qs ya decodifica %2C, espacios, etc.).
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    for param in ("center", "ll", "q", "query", "daddr", "destination", "saddr"):
        for val in qs.get(param, []):
            m = re.match(r"^\s*(-?\d+\.\d+)\s*[,;]\s*\+?(-?\d+\.\d+)\s*$", val)
            if m:
                r = _to_pair(m)
                if r:
                    return r

    # 5) /maps/search/{lat},{+}{lng} — pin soltado.
    m = re.search(r"/maps/search/(-?\d+\.\d+)\s*[,;]\s*\+?(-?\d+\.\d+)", url)
    if m:
        r = _to_pair(m)
        if r:
            return r

    # 6) /maps/place/...@lat,lng
    m = re.search(r"/maps/place/.*?/@(-?\d+\.\d+),(-?\d+\.\d+)", url)
    if m:
        r = _to_pair(m)
        if r:
            return r

    # 7) @lat,lng — viewport (último recurso).
    m = _LAT_LNG_RE.search(url)
    if m:
        r = _to_pair(m)
        if r:
            return r

    return None


def _try_extract_from_html(html: str) -> tuple[float, float] | None:
    """Busca coordenadas en el HTML priorizando fuentes de mayor precisión.

    El HTML de Google Maps contiene MUCHAS coordenadas embebidas (viewport,
    sugerencias, POIs). Se prioriza el pin exacto y, para `@lat,lng`, se elige
    el de MAYOR precisión decimal (el pin suele tener más decimales que el
    centro de viewport redondeado).
    """
    # 1) !3d{lat}!4d{lng} — pin exacto embebido.
    for lat_s, lng_s in _D3D4_RE.findall(html):
        try:
            lat, lng = float(lat_s), float(lng_s)
        except ValueError:
            continue
        if _valid_pair(lat, lng):
            return lat, lng

    # 2) data-lat / data-lng (atributos comunes de Google Maps).
    data_lat = re.search(r'data-lat="(-?\d+\.\d+)"', html)
    data_lng = re.search(r'data-lng="(-?\d+\.\d+)"', html)
    if data_lat and data_lng:
        try:
            lat, lng = float(data_lat.group(1)), float(data_lng.group(1))
        except ValueError:
            lat = lng = None
        if lat is not None and _valid_pair(lat, lng):
            return lat, lng

    # 3) @lat,lng — elegir el de mayor precisión decimal (heurística del pin).
    best = None  # (decimales, lat, lng)
    for m in _LAT_LNG_RE.finditer(html):
        try:
            lat, lng = float(m.group(1)), float(m.group(2))
        except ValueError:
            continue
        if not _valid_pair(lat, lng):
            continue
        decimals = len(m.group(1).split(".")[1]) + len(m.group(2).split(".")[1])
        if best is None or decimals > best[0]:
            best = (decimals, lat, lng)

    if best:
        return best[1], best[2]

    return None


@router.post(
    "/parse-map-link",
    response_model=ParseMapLinkResponse,
    summary="Extraer coordenadas de un link de Google Maps",
    description="Sigue redirects de un link acortado de Google Maps y extrae latitud/longitud "
                "mediante regex sobre la URL final y, como fallback, sobre el HTML de la página.",
)
async def parse_map_link(payload: ParseMapLinkRequest):
    """Sigue redirects de un link acortado de Google Maps y extrae coordenadas.

    Soportados:
      - https://maps.app.goo.gl/...  (acortado — resuelve HTML y extrae del contenido)
      - https://www.google.com/maps/place/...@lat,lng/
      - https://www.google.com/maps/@lat,lng,zoom
      - https://www.google.com/maps/?q=lat,lng
      - https://www.google.com/maps/search/lat,lng
      - Cualquier URL de Google Maps con query params q=/query=/center=/ll=
    """
    # ── Fase 1: Seguir redirects y obtener URL final + HTML ──
    final_url, html_body = await _resolve_redirects(str(payload.url))

    # ── Fase 2: Intentar extraer de la URL final ──
    result = _try_extract_from_url(final_url)
    if result:
        return ParseMapLinkResponse(latitude=result[0], longitude=result[1])

    # ── Fase 3: Fallback → extraer del HTML de la página ──
    result = _try_extract_from_html(html_body)
    if result:
        return ParseMapLinkResponse(latitude=result[0], longitude=result[1])

    raise HTTPException(
        status_code=400,
        detail="No se pudieron extraer coordenadas del enlace proporcionado. "
               "Asegúrate de que sea un enlace válido de Google Maps."
    )
