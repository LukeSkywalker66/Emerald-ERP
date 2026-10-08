"""
Normalización de códigos escaneados.

Corrige el desajuste de teclado más común en entornos hispanohablantes:
un lector de código de barras configurado como teclado US escribe el guion
de los códigos propios ``AAA-YYYY-NNNNN`` como apóstrofe cuando la estación
tiene layout de teclado español (es-AR). Aquí restauramos los guiones.
"""
from __future__ import annotations

import re

# Códigos propios con apóstrofes en lugar de guiones (ej. CNT'2026'00011).
_TRACKED_UNIT_APOSTROPHE = re.compile(r"^[A-Z]{3}'\d{4}'\d+$")


def normalize_scanned_code(code: str) -> str:
    """Devuelve el código normalizado (uppercase y con guiones restaurados).

    Solo transforma códigos que coinciden exactamente con el formato propio
    de unidad trazable usando apóstrofes; cualquier otro valor se devuelve
    tal cual (solo ``strip().upper()``).
    """
    cleaned = (code or "").strip().upper()
    if _TRACKED_UNIT_APOSTROPHE.fullmatch(cleaned):
        return cleaned.replace("'", "-")
    return cleaned
