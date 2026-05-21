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


def _try_extract_from_url(url: str) -> tuple[float, float] | None:
    """Intenta extraer coordenadas de la URL final mediante patrones conocidos."""
    patterns = [
        re.compile(r"/maps/place/.*?/@(-?\d+\.\d+),(-?\d+\.\d+)"),       # /maps/place/...@lat,lng/
        re.compile(r"/maps/?\?q=(-?\d+\.\d+),(-?\d+\.\d+)"),            # /maps/?q=lat,lng
        re.compile(r"/maps/search/(-?\d+\.\d+),(-?\d+\.\d+)"),          # /maps/search/lat,lng
        re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)"),                      # @lat,lng (catch-all)
        re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)"),                  # data=!3dlat!4dlng
    ]

    for pat in patterns:
        m = pat.search(url)
        if m:
            return float(m.group(1)), float(m.group(2))

    # Fallback: extract from query parameters
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    for param in ("q", "query", "center", "ll"):
        vals = qs.get(param, [])
        for val in vals:
            m = re.match(r"^(-?\d+\.\d+),(-?\d+\.\d+)$", val)
            if m:
                return float(m.group(1)), float(m.group(2))

    return None


def _try_extract_from_html(html: str) -> tuple[float, float] | None:
    """Busca coordenadas @lat,lng en el HTML de la página (fallback para goo.gl)."""
    # Buscar @lat,lng en el HTML (Google Maps lo embedé en el contenido JS)
    for m in _LAT_LNG_RE.finditer(html):
        lat, lng = float(m.group(1)), float(m.group(2))
        # Validar rangos de latitud/longitud para descartar falsos positivos
        if -90 <= lat <= 90 and -180 <= lng <= 180:
            return lat, lng

    # Buscar !3dlat!4dlng en el HTML (data parameter expandido)
    d3d4 = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", html)
    if d3d4:
        lat, lng = float(d3d4.group(1)), float(d3d4.group(2))
        if -90 <= lat <= 90 and -180 <= lng <= 180:
            return lat, lng

    # Buscar data attributes comunes de Google Maps
    # ej: data-lat="-34.6037" data-lng="-58.3816"
    data_lat = re.search(r'data-lat="(-?\d+\.\d+)"', html)
    data_lng = re.search(r'data-lng="(-?\d+\.\d+)"', html)
    if data_lat and data_lng:
        lat, lng = float(data_lat.group(1)), float(data_lng.group(1))
        if -90 <= lat <= 90 and -180 <= lng <= 180:
            return lat, lng

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
