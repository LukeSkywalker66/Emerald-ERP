"""
BarcodeScannerEngine — Motor central de identificación de códigos de barra.

Orquesta múltiples validadores (pluggables) para identificar si un código
escaneado corresponde a un producto (SKU), un número de serie, una MAC
address (descartar), o es desconocido.

Uso:
    from src.barcode_reader import BarcodeScannerEngine, ScanContext
    from src.barcode_reader.validators import (
        ProductCodeValidator,
        SerialFormatValidator,
        ITUTG984Validator,
        MacAddressFilter,
        GenericSerialValidator,
    )

    engine = BarcodeScannerEngine()
    engine.register_validator(ProductCodeValidator())
    engine.register_validator(SerialFormatValidator())
    engine.register_validator(ITUTG984Validator())
    engine.register_validator(MacAddressFilter())
    engine.register_validator(GenericSerialValidator())

    # Cargar patrones desde DB
    engine.load_patterns(db_session)

    context = ScanContext(
        module="PURCHASE",
        known_product_id=42,
        known_group_name="ONU/ONT",
    )
    result = engine.identify("ALC544A1F234", context, db=db_session)
    if result.is_acceptable():
        print(f"Identificado: {result.product_name}")
"""
from __future__ import annotations
import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from src.barcode_reader.schemas import (
    ScanType,
    Confidence,
    ScanContext,
    ScanResult,
)
from src.barcode_reader.protocols import BaseValidator
from src.barcode_reader.patterns import SerialPatternRegistry

logger = logging.getLogger("uvicorn.error")


class BarcodeScannerEngine:
    """
    Motor de identificación de códigos de barra.

    Características:
    - Validadores pluggables registrados con prioridad
    - Cache de patrones SN desde DB
    - Contexto de escaneo para validación consciente del módulo
    """

    def __init__(self):
        self._validators: List[BaseValidator] = []
        self._pattern_registry = SerialPatternRegistry()

    # ---------------------------------------------------------------
    # Registry de validadores
    # ---------------------------------------------------------------

    def register_validator(self, validator: BaseValidator) -> None:
        """
        Registra un validador en el engine.

        Los validadores se ordenan por prioridad ascendente
        (menor número = mayor prioridad).
        """
        if not isinstance(validator, BaseValidator):
            logger.warning(
                "Validator %s does not implement BaseValidator protocol",
                type(validator).__name__,
            )
        self._validators.append(validator)
        self._validators.sort(key=lambda v: getattr(v, "priority", 50))
        logger.debug(
            "Registered validator '%s' (priority=%d) — total: %d",
            getattr(validator, "name", type(validator).__name__),
            getattr(validator, "priority", 50),
            len(self._validators),
        )

    def register_validators(self, *validators: BaseValidator) -> None:
        """Registra múltiples validadores de una sola vez."""
        for v in validators:
            self.register_validator(v)

    def unregister_validator(self, name: str) -> None:
        """Elimina un validador por nombre."""
        self._validators = [
            v for v in self._validators
            if getattr(v, "name", "") != name
        ]

    @property
    def validators(self) -> List[BaseValidator]:
        """Lista de validadores registrados (ordenados por prioridad)."""
        return list(self._validators)

    # ---------------------------------------------------------------
    # Pattern registry
    # ---------------------------------------------------------------

    def load_patterns(self, db: Session) -> None:
        """Carga los patrones SN desde la tabla serial_formats en DB."""
        self._pattern_registry.load_from_db(db)

    @property
    def pattern_registry(self) -> SerialPatternRegistry:
        """Acceso al registry de patrones."""
        return self._pattern_registry

    # ---------------------------------------------------------------
    # Identificación
    # ---------------------------------------------------------------

    def identify(
        self,
        code: str,
        context: Optional[ScanContext] = None,
        db: Optional[Session] = None,
    ) -> ScanResult:
        """
        Identifica un código escaneado.

        Args:
            code: String crudo del scanner.
            context: Contexto del escaneo. Si es None, se crea uno por defecto.
            db: Sesión de BD opcional (necesaria para validadores que consultan catálogo).

        Returns:
            ScanResult con el tipo identificado y metadatos.
        """
        if not code or not code.strip():
            return ScanResult(
                type=ScanType.UNKNOWN,
                raw_value=code or "",
                confidence=Confidence.LOW,
                validated=False,
                validator_name="engine",
                message="Código vacío",
            )

        # Normalizar contexto
        if context is None:
            context = ScanContext(module="UNKNOWN")

        # Adjuntar DB session al contexto para que los validadores puedan usarla
        # Usamos un atributo privado para no contaminar la API pública
        object.__setattr__(context, "_db", db)
        object.__setattr__(context, "_pattern_registry", self._pattern_registry)

        # Recorrer validadores en orden de prioridad
        first_error: Optional[str] = None

        for validator in self._validators:
            try:
                result = validator.validate(code, context)
                if result is not None:
                    logger.info(
                        "Scanner identified '%s' as %s (validator=%s, conf=%s)",
                        code[:20],
                        result.type.name,
                        result.validator_name,
                        result.confidence.name,
                    )
                    return result
            except Exception as e:
                logger.error(
                    "Validator '%s' error for code '%s': %s",
                    getattr(validator, "name", type(validator).__name__),
                    code[:20],
                    e,
                    exc_info=True,
                )
                if first_error is None:
                    first_error = str(e)

        # Ningún validador identificó el código
        cleaned = code.strip().upper()
        return ScanResult(
            type=ScanType.UNKNOWN,
            raw_value=code,
            cleaned_value=cleaned,
            confidence=Confidence.LOW,
            validated=False,
            validator_name="engine",
            message=(
                f"Código no reconocido: '{code[:30]}'"
                + (f". Error interno: {first_error}" if first_error else "")
            ),
        )

    # ---------------------------------------------------------------
    # Helpers de alto nivel
    # ---------------------------------------------------------------

    def is_product_code(self, code: str, db: Session) -> bool:
        """Verifica rápidamente si un código es un SKU de producto."""
        result = self.identify(code, db=db)
        return result.type == ScanType.PRODUCT_CODE

    def is_valid_serial(
        self,
        code: str,
        product_id: int,
        group_name: Optional[str] = None,
    ) -> bool:
        """Verifica si un código es un serial válido para un producto."""
        context = ScanContext(
            module="VALIDATION",
            known_product_id=product_id,
            known_group_name=group_name,
        )
        result = self.identify(code, context)
        return (
            result.type == ScanType.SERIAL_NUMBER
            and result.validated
            and result.confidence in (Confidence.HIGH, Confidence.MEDIUM)
        )

    def sanitize_code(self, code: str) -> str:
        """
        Sanitiza un código escaneado: uppercase, sin espacios.
        Útil para preparar el input antes de pasarlo a los validadores.
        """
        return code.strip().upper()
