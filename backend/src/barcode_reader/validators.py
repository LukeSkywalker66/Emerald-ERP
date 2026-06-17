"""
Validators for the barcode reader engine.
Each validator implements the BaseValidator protocol and handles
a specific type of code identification.
"""
from __future__ import annotations
import logging
import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.barcode_reader.schemas import (
    ScanType,
    Confidence,
    ScanContext,
    ScanResult,
)

logger = logging.getLogger("uvicorn.error")


# ============================================
# Product Code Validator
# ============================================


class ProductCodeValidator:
    """
    Validador de códigos de producto (SKU).

    Busca el código escaneado en la tabla `products` por SKU.
    Si encuentra match, retorna PRODUCT_CODE con confianza HIGH.
    """

    name: str = "product_code"
    priority: int = 10  # Más prioritario: intentamos SKU primero

    def validate(self, code: str, context: ScanContext) -> Optional[ScanResult]:
        """Busca el código como SKU en el catálogo de productos."""
        if not code or not code.strip():
            return None

        cleaned = code.strip().upper()
        db: Session = getattr(context, "_db", None)

        if db is None:
            logger.debug("ProductCodeValidator: no DB session in context, skipping")
            return None

        try:
            from src.models.inventory import Product

            # Buscar por SKU exacto (case-insensitive)
            product = db.execute(
                select(Product).where(Product.sku.ilike(cleaned))
            ).scalar_one_or_none()

            if product is not None:
                return ScanResult(
                    type=ScanType.PRODUCT_CODE,
                    raw_value=code,
                    cleaned_value=cleaned,
                    product_id=product.id,
                    product_name=product.name,
                    product_sku=product.sku,
                    group_id=product.group_id,
                    group_name=product.group.name if product.group else None,
                    confidence=Confidence.HIGH,
                    validated=True,
                    validator_name=self.name,
                    message=f"Producto identificado: {product.name} ({product.sku})",
                )

            # No encontrado como SKU
            return None

        except Exception as e:
            logger.error("ProductCodeValidator error: %s", e, exc_info=True)
            return None


# ============================================
# Serial Format DB Validator
# ============================================


class SerialFormatValidator:
    """
    Valida el serial contra el regex definido en Product.serial_validation_regex.
    Si el producto tiene regex, lo usa. Si no, delega a ITU-T G.984 (ONU) o genérico.
    """

    name: str = "serial_format_db"
    priority: int = 20

    def validate(self, code: str, context: ScanContext) -> Optional[ScanResult]:
        """Valida serial contra Product.serial_validation_regex."""
        if not code or not code.strip():
            return None
        if not context.known_product_id:
            return None

        cleaned = code.strip().upper()
        db = getattr(context, "_db", None)

        # Intentar obtener regex del producto
        product_regex = None
        if db:
            try:
                from src.models.inventory import Product as ProductModel
                product = db.get(ProductModel, context.known_product_id)
                if product and product.serial_validation_regex:
                    product_regex = product.serial_validation_regex
            except Exception:
                pass

        if product_regex:
            import re
            if re.match(product_regex, cleaned):
                return ScanResult(
                    type=ScanType.SERIAL_NUMBER,
                    raw_value=code,
                    cleaned_value=cleaned,
                    product_id=context.known_product_id,
                    confidence=Confidence.HIGH,
                    validated=True,
                    validator_name=self.name,
                    message=f"Serial válido según patrón del producto",
                )
            return None  # No cumple el regex del producto → rechazar

        # Sin regex → intentar fallback por grupo
        from src.barcode_reader.patterns import DEFAULT_GROUP_PATTERNS, ITU_T_G984_PATTERN
        import re

        if context.known_group_name:
            gn = context.known_group_name.strip().upper()
            for group_key in DEFAULT_GROUP_PATTERNS:
                if group_key in gn or gn in group_key:
                    if re.match(ITU_T_G984_PATTERN, cleaned):
                        return ScanResult(
                            type=ScanType.SERIAL_NUMBER,
                            raw_value=code,
                            cleaned_value=cleaned,
                            product_id=context.known_product_id,
                            confidence=Confidence.HIGH,
                            validated=True,
                            validator_name=self.name,
                            message="Serial ONU/ONT válido (ITU-T G.984)",
                        )
                    return None  # ONU pero no cumple G.984 → rechazar

        return None  # Sin regex y sin grupo → delegar a otros validadores


# ============================================
# ITU-T G.984 Validator (ONU/ONT)
# ============================================


class ITUTG984Validator:
    """
    Validador del estándar ITU-T G.984 para ONT/ONU.

    Aplica si:
    - El contexto tiene grupo conocido "ONU", "ONT" o "ONU/ONT"
    - O no hay contexto de producto pero el código cumple G.984

    Formato: 4 caracteres alfanuméricos (vendor) + 8 alfanuméricos (serial)
    """

    name: str = "itu_t_g984"
    priority: int = 30

    def validate(self, code: str, context: ScanContext) -> Optional[ScanResult]:
        """Valida un serial contra el estándar ITU-T G.984.

        Aplica si:
        - El contexto tiene grupo conocido "ONU", "ONT" o "ONU/ONT"
        - O el código cumple con el patrón G.984 sin contexto de grupo

        Formato: 4 chars alfanuméricos (vendor) + 8 chars alfanuméricos (serial)
        """
        if not code or not code.strip():
            return None

        cleaned = code.strip().upper()

        # Determinar si el contexto indica que es una ONU/ONT
        is_onu_context = False
        if context.known_group_name:
            gn = context.known_group_name.strip().upper()
            is_onu_context = any(
                keyword in gn for keyword in ["ONU", "ONT"]
            )

        # Verificar formato G.984
        import re
        g984_pattern = r"^[A-Z0-9]{4}[A-Z0-9]{8}$"
        matches_g984 = bool(re.match(g984_pattern, cleaned))

        # Solo validamos si:
        # a) Hay contexto ONU, o
        # b) El código cumple G.984 (posible ONU sin contexto)
        if not matches_g984:
            return None

        if not is_onu_context and not context.known_product_id:
            # El código cumple G.984 pero no tenemos contexto de producto
            # ni de grupo. No podemos afirmar que sea un serial.
            return None

        # Tenemos match: contexto ONU o código G.984 con producto conocido
        return ScanResult(
            type=ScanType.SERIAL_NUMBER,
            raw_value=code,
            cleaned_value=cleaned,
            product_id=context.known_product_id,
            group_id=context.known_group_id,
            group_name=context.known_group_name,
            confidence=Confidence.HIGH if is_onu_context else Confidence.MEDIUM,
            validated=True,
            validator_name=self.name,
            message=(
                "Serial ONU/ONT válido según ITU-T G.984"
                if is_onu_context
                else "Serial con formato ITU-T G.984"
            ),
        )


# ============================================
# MAC Address Filter
# ============================================


import re as _re

# Patrones MAC address (autocontenido, no depende del registry)
_MAC_PATTERNS = [
    _re.compile(r"^([0-9A-Fa-f]{2}[:]){5}[0-9A-Fa-f]{2}$"),   # AA:BB:CC:DD:EE:FF
    _re.compile(r"^([0-9A-Fa-f]{2}[-]){5}[0-9A-Fa-f]{2}$"),   # AA-BB-CC-DD-EE-FF
    _re.compile(r"^([0-9A-Fa-f]{4}[.]){2}[0-9A-Fa-f]{4}$"),   # AABB.CCDD.EEFF
    _re.compile(r"^[0-9A-Fa-f]{12}$"),                         # A8D4E0D0CFBE (sin separadores)
]

def _is_mac_address(code: str) -> bool:
    """Detecta si un código es una dirección MAC."""
    return any(p.match(code) for p in _MAC_PATTERNS)


class MacAddressFilter:
    """
    Filtro de direcciones MAC.

    Detecta direcciones MAC en formatos comunes:
    - AA:BB:CC:DD:EE:FF
    - AA-BB-CC-DD-EE-FF
    - AABB.CCDD.EEFF

    Retorna ScanResult con type=MAC_ADDRESS para que el engine
    pueda descartarlo apropiadamente.
    """

    name: str = "mac_address_filter"
    priority: int = 5  # Alta prioridad: descartar rápido

    def validate(self, code: str, context: ScanContext) -> Optional[ScanResult]:
        """Detecta si el código es una MAC address."""
        if not code or not code.strip():
            return None

        cleaned = code.strip()

        if _is_mac_address(cleaned):
            return ScanResult(
                type=ScanType.MAC_ADDRESS,
                raw_value=code,
                cleaned_value=cleaned,
                confidence=Confidence.HIGH,
                validated=False,
                validator_name=self.name,
                message="Dirección MAC detectada e ignorada",
            )

        return None


# ============================================
# Tracked Unit Validator
# ============================================


class TrackedUnitValidator:
    """
    Identifica códigos generados por Emerald para unidades trazables.

    Formato esperado: AAA-YYYY-NNNNN
    Ej: DRP-2026-00001
    """

    name: str = "tracked_unit"
    priority: int = 15
    _pattern = re.compile(r"^[A-Z]{3}-\d{4}-\d+$")

    def validate(self, code: str, context: ScanContext) -> Optional[ScanResult]:
        if not code or not code.strip():
            return None

        cleaned = code.strip().upper()
        if not self._pattern.match(cleaned):
            return None

        db: Session = getattr(context, "_db", None)
        if db is None:
            return None

        try:
            from src.models.inventory import SerialItem

            serial_item = db.execute(
                select(SerialItem).where(SerialItem.serial_number == cleaned)
            ).scalar_one_or_none()

            if serial_item is None:
                return None

            return ScanResult(
                type=ScanType.SERIAL_NUMBER,
                raw_value=code,
                cleaned_value=cleaned,
                product_id=serial_item.product_id,
                product_name=serial_item.product.name if serial_item.product else None,
                product_sku=serial_item.product.sku if serial_item.product else None,
                group_id=serial_item.product.group_id if serial_item.product else None,
                group_name=serial_item.product.group.name if serial_item.product and serial_item.product.group else None,
                confidence=Confidence.HIGH,
                validated=True,
                validator_name=self.name,
                message=f"Unidad trazable identificada: {cleaned}",
            )
        except Exception as exc:
            logger.error("TrackedUnitValidator error: %s", exc, exc_info=True)
            return None


# ============================================
# Generic Serial Validator (Fallback)
# ============================================


class GenericSerialValidator:
    """
    Validador genérico de números de serie.

    Último recurso: si ningún otro validador identificó el código,
    verifica si cumple con características básicas de serial:
    - Alfanumérico (uppercase)
    - Entre 4 y 50 caracteres
    - Sin caracteres extraños

    Solo aplica si hay un contexto de producto conocido (para evitar
    falsos positivos cuando no sabemos qué esperar).
    """

    name: str = "generic_serial"
    priority: int = 100  # Baja prioridad: último recurso

    def validate(self, code: str, context: ScanContext) -> Optional[ScanResult]:
        """Último recurso: acepta alfanumérico si el producto NO tiene regex."""
        if not code or not code.strip():
            return None
        if not context.known_product_id:
            return None

        cleaned = code.strip().upper()

        # Si el producto tiene regex, SerialFormatValidator ya decidió → no intervenir
        db = getattr(context, "_db", None)
        if db:
            try:
                from src.models.inventory import Product as ProductModel
                product = db.get(ProductModel, context.known_product_id)
                if product and product.serial_validation_regex:
                    return None
            except Exception:
                pass

        # Sin regex → aceptar alfanumérico
        import re
        if re.match(r"^[A-Z0-9][A-Z0-9\-]{3,49}$", cleaned):
            return ScanResult(
                type=ScanType.SERIAL_NUMBER,
                raw_value=code, cleaned_value=cleaned,
                product_id=context.known_product_id,
                confidence=Confidence.MEDIUM, validated=True,
                validator_name=self.name,
                message="Serial válido (validación genérica)",
            )
        return None
