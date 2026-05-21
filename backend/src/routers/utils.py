"""Router de utilidades — parse-map-link para geolocalización."""
import re
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx

router = APIRouter(tags=["Utilities"])
logger = logging.getLogger(__name__)


class ParseMapLinkRequest(BaseModel):
    """Payload con la URL de Google Maps a resolver."""
    url: HttpUrl


class ParseMapLinkResponse(BaseModel):
    """Coordenadas extraídas del link."""
    latitude: float
    longitude: float


@router.post(
    "/parse-map-link",
    response_model=ParseMapLinkResponse,
    summary="Extraer coordenadas de un link de Google Maps",
    description="Sigue redirects de un link acortado de Google Maps y extrae latitud/longitud mediante regex.",
)
async def parse_map_link(payload: ParseMapLinkRequest):
    """Sigue redirects de un link acortado de Google Maps y extrae coordenadas.

    Soportados:
      - https://maps.app.goo.gl/...  (acortado)
      - https://www.google.com/maps/place/...@lat,lng/
      - https://www.google.com/maps/?q=lat,lng
      - https://www.google.com/maps/search/lat,lng
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(str(payload.url))
            final_url = str(resp.url)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Tiempo de espera agotado al resolver la URL")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al resolver URL: {str(e)}")

    # Pattern 1: /maps/place/...@lat,lng/
    pattern1 = re.compile(r"/maps/place/.*?/@(-?\d+\.\d+),(-?\d+\.\d+)")
    # Pattern 2: /maps/?q=lat,lng (trailing slash optional)
    pattern2 = re.compile(r"/maps/?\?q=(-?\d+\.\d+),(-?\d+\.\d+)")
    # Pattern 3: /maps/search/lat,lng
    pattern3 = re.compile(r"/maps/search/(-?\d+\.\d+),(-?\d+\.\d+)")
    # Pattern 4: @lat,lng en cualquier parte (catch-all)
    pattern4 = re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)")

    for pattern in [pattern1, pattern2, pattern3, pattern4]:
        match = pattern.search(final_url)
        if match:
            return ParseMapLinkResponse(
                latitude=float(match.group(1)),
                longitude=float(match.group(2))
            )

    raise HTTPException(
        status_code=400,
        detail="No se pudieron extraer coordenadas del enlace proporcionado. "
               "Asegúrate de que sea un enlace válido de Google Maps."
    )
