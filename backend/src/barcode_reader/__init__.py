"""
Barcode Reader Intelligence Module
==================================
Motor reutilizable de identificación y validación de códigos de barra.

Uso básico:
    from src.barcode_reader import BarcodeScannerEngine, ScanContext

    engine = BarcodeScannerEngine()
    context = ScanContext(module="PURCHASE", known_product_id=42)
    result = engine.identify("ALC544A1F234", context)
    print(result.type, result.validated, result.product_name)
"""

from src.barcode_reader.core import BarcodeScannerEngine
from src.barcode_reader.schemas import (
    ScanType,
    Confidence,
    ScanContext,
    ScanResult,
)
from src.barcode_reader.protocols import BaseValidator
from src.barcode_reader.patterns import SerialPatternRegistry

__all__ = [
    "BarcodeScannerEngine",
    "ScanType",
    "Confidence",
    "ScanContext",
    "ScanResult",
    "BaseValidator",
    "SerialPatternRegistry",
]
