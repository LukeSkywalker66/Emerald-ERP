"""
Serial Pattern Registry
=======================
Mantiene un registro de patrones de números de serie asociados
a productos. La fuente primaria es la tabla `serial_formats` en DB,
con fallback a patrones por defecto (ITU-T G.984 para ONU/ONT).
"""
from __future__ import annotations
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

logger = logging.getLogger("uvicorn.error")


# ============================================
# Pattern definitions
# ============================================

# Patrones conocidos como constantes (fallback si no hay DB)
# Basado en ITU-T G.984.4: 4 chars vendor code + 8 chars serial
ITU_T_G984_PATTERN = r"^[A-Z0-9]{4}[A-Z0-9]{8,12}$"
ITU_T_G984_DESCRIPTION = "ITU-T G.984 ONT - 4 chars vendor + 8-12 chars serial"

# Patrón genérico para seriales
GENERIC_SERIAL_PATTERN = r"^[A-Z0-9][A-Z0-9\-]{3,49}$"
GENERIC_SERIAL_DESCRIPTION = "Alfanumérico 4-50 chars, uppercase, guiones permitidos"

# Patrón MAC address (para detectar y filtrar)
MAC_ADDRESS_PATTERN = r"^([0-9A-Fa-f]{2}[:.\-]){5}[0-9A-Fa-f]{2}$"


@dataclass
class SerialPattern:
    """
    Representa un patrón de número de serie asociado a un producto.

    Puede originarse de:
    - DB (tabla serial_formats)
    - Fallback por grupo de producto (ITU-T G.984 para ONU/ONT)
    - Fallback genérico
    """

    product_id: int
    regex_pattern: str
    description: str = ""
    is_from_db: bool = False
    compiled: re.Pattern = field(init=False)

    def __post_init__(self):
        self.compiled = re.compile(self.regex_pattern)

    def matches(self, value: str) -> bool:
        """Verifica si un valor cumple con el patrón."""
        return bool(self.compiled.match(value))


# ============================================
# Default patterns por grupo de producto
# ============================================

# Mapeo de nombre de grupo de producto a patrón por defecto
# Usado cuando no hay patrón registrado en DB para un producto
# pero conocemos su grupo (ej: "ONU/ONT" -> ITU-T G.984)
DEFAULT_GROUP_PATTERNS: Dict[str, str] = {
    "ONU": ITU_T_G984_PATTERN,
    "ONT": ITU_T_G984_PATTERN,
    "ONU/ONT": ITU_T_G984_PATTERN,
    "ONU/ONT/ONTs": ITU_T_G984_PATTERN,
    "ROUTER": GENERIC_SERIAL_PATTERN,
    "ROUTER DOMICILIARIO": GENERIC_SERIAL_PATTERN,
}


# ============================================
# Registry
# ============================================


class SerialPatternRegistry:
    """
    Registry de patrones SN.

    - Carga patrones desde DB (tabla serial_formats)
    - Cachea en memoria para evitar N+1 queries
    - Provee fallback por grupo de producto
    - Provee fallback genérico
    """

    def __init__(self):
        self._patterns: Dict[int, SerialPattern] = {}  # product_id -> pattern
        self._loaded = False

    def load_from_db(self, db: Session) -> None:
        """
        Carga todos los patrones activos desde la tabla serial_formats.
        """
        try:
            from src.models.inventory import SerialFormat as SerialFormatModel

            records = db.execute(
                select(SerialFormatModel).where(SerialFormatModel.is_active == True)  # noqa: E712
            ).scalars().all()

            for record in records:
                try:
                    pattern = SerialPattern(
                        product_id=record.product_id,
                        regex_pattern=record.regex_pattern,
                        description=record.description or "",
                        is_from_db=True,
                    )
                    self._patterns[record.product_id] = pattern
                except re.error as e:
                    logger.warning(
                        "Invalid regex pattern for product %d: %s - %s",
                        record.product_id, record.regex_pattern, e
                    )

            self._loaded = True
            logger.info(
                "Loaded %d serial format patterns from DB", len(records)
            )
        except Exception as e:
            logger.warning("Could not load serial formats from DB: %s", e)
            self._loaded = True  # Marcamos como cargado para no reintentar

    def get_pattern(self, product_id: int) -> Optional[SerialPattern]:
        """Obtiene el patrón registrado para un producto."""
        return self._patterns.get(product_id)

    def get_pattern_or_fallback(
        self,
        product_id: int,
        group_name: Optional[str] = None,
    ) -> SerialPattern:
        """
        Obtiene el patrón para un producto, con fallback:
        1. Patrón registrado en DB
        2. Patrón por grupo de producto (ITU-T G.984 para ONU)
        3. Patrón genérico
        """
        # 1. Patrón registrado
        pattern = self.get_pattern(product_id)
        if pattern:
            return pattern

        # 2. Fallback por grupo
        if group_name:
            normalized_group = group_name.strip().upper()
            for group_key, group_pattern in DEFAULT_GROUP_PATTERNS.items():
                if group_key in normalized_group or normalized_group in group_key:
                    return SerialPattern(
                        product_id=product_id,
                        regex_pattern=group_pattern,
                        description=f"Fallback: {group_key}",
                        is_from_db=False,
                    )

        # 3. Fallback genérico
        return SerialPattern(
            product_id=product_id,
            regex_pattern=GENERIC_SERIAL_PATTERN,
            description=GENERIC_SERIAL_DESCRIPTION,
            is_from_db=False,
        )

    def is_mac_address(self, code: str) -> bool:
        """Detecta si un código es una dirección MAC."""
        return bool(re.match(MAC_ADDRESS_PATTERN, code.strip()))

    def is_valid_serial(self, code: str, product_id: int,
                        group_name: Optional[str] = None) -> bool:
        """
        Valida un serial contra el patrón del producto (con fallback).
        """
        pattern = self.get_pattern_or_fallback(product_id, group_name)
        return pattern.matches(code.upper().strip())

    def clear_cache(self) -> None:
        """Limpia el cache de patrones (forzar recarga desde DB)."""
        self._patterns.clear()
        self._loaded = False
