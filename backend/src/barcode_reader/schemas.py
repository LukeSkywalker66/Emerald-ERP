"""
Schemas for the barcode reader engine.
Define los tipos de datos intercambiados entre el scanner,
los validadores, y los módulos consumidores.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import FrozenSet, Optional


class ScanType(Enum):
    """Tipo de código identificado por el motor."""

    PRODUCT_CODE = auto()
    """Código de producto / SKU identificado en el catálogo."""

    SERIAL_NUMBER = auto()
    """Número de serie válido según las reglas configuradas."""

    MAC_ADDRESS = auto()
    """Dirección MAC — debe ser ignorada/descartada."""

    UNKNOWN = auto()
    """No se pudo identificar el código con ningún validador."""


class Confidence(Enum):
    """Nivel de confianza en la identificación."""

    HIGH = auto()
    """Match exacto contra DB (SKU o pattern registrado)."""

    MEDIUM = auto()
    """Match por heurística/fallback (ITU-T G.984, genérico)."""

    LOW = auto()
    """No se pudo identificar con certeza."""


@dataclass
class ScanContext:
    """
    Contexto de escaneo.
    Provee información del módulo consumidor y estado actual
    para ayudar a los validadores a identificar correctamente.
    """

    module: str
    """Módulo que está usando el scanner: PURCHASE | DELIVERY | RECEIPT."""

    known_product_id: Optional[int] = None
    """Si ya se conoce el producto (ej: seleccionado en formulario de compra)."""

    known_group_id: Optional[int] = None
    """ID del grupo de producto (ONU/ONT, Router, etc) si se conoce."""

    known_group_name: Optional[str] = None
    """Nombre del grupo (ej: 'ONU/ONT') para validación ITU-T G.984."""

    proposal_product_ids: Optional[FrozenSet[int]] = None
    """
    IDs de productos en la propuesta de delivery.
    Sirve para validar que el escaneo corresponda a la propuesta.
    """

    known_serial_number: Optional[str] = None
    """
    Si se escaneó primero un serial (sin producto conocido),
    se almacena aquí para que el módulo consumidor lo resuelva.
    """


@dataclass
class ScanResult:
    """
    Resultado del proceso de identificación.
    Retornado por el engine después de evaluar todos los validadores.
    """

    type: ScanType
    """Tipo de código identificado."""

    raw_value: str
    """String crudo tal como llegó del scanner."""

    cleaned_value: Optional[str] = None
    """Valor sanitizado (uppercase, sin espacios, etc)."""

    product_id: Optional[int] = None
    """ID del producto resuelto (si aplica)."""

    product_name: Optional[str] = None
    """Nombre del producto resuelto."""

    product_sku: Optional[str] = None
    """SKU del producto resuelto."""

    group_id: Optional[int] = None
    """ID del grupo de producto al que pertenece."""

    group_name: Optional[str] = None
    """Nombre del grupo de producto."""

    confidence: Confidence = Confidence.LOW
    """Nivel de confianza en la identificación."""

    validated: bool = False
    """True si pasó todas las validaciones de formato."""

    validator_name: str = ""
    """Nombre del validador que produjo este resultado."""

    message: str = ""
    """Mensaje legible para el operador (feedback visual)."""

    def is_acceptable(self) -> bool:
        """
        Un resultado es aceptable si fue identificado con al menos
        confianza MEDIUM y pasó las validaciones.
        """
        return (
            self.type in (ScanType.PRODUCT_CODE, ScanType.SERIAL_NUMBER)
            and self.confidence in (Confidence.HIGH, Confidence.MEDIUM)
            and self.validated
        )

    def __repr__(self) -> str:
        return (
            f"<ScanResult type={self.type.name} "
            f"value={self.cleaned_value or self.raw_value!r} "
            f"product={self.product_id} "
            f"validated={self.validated} "
            f"confidence={self.confidence.name}>"
        )
