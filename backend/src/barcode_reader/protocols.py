"""
Protocols for pluggable barcode validators.
Any validator that implements BaseValidator can be registered
in the BarcodeScannerEngine.
"""
from __future__ import annotations
from typing import Optional, Protocol, runtime_checkable

from src.barcode_reader.schemas import ScanContext, ScanResult


@runtime_checkable
class BaseValidator(Protocol):
    """
    Protocolo para validadores de código de barra.

    Cada validador debe implementar `validate` que recibe un código
    escaneado y el contexto actual de escaneo. Si el validador
    reconoce el código, retorna un ScanResult. Si no, retorna None.

    El engine recorre los validadores en orden de registro y usa
    el primer resultado no-None.
    """

    name: str
    """Nombre del validador para logging y debugging."""

    priority: int
    """Menor número = mayor prioridad (se evalúa primero)."""

    def validate(self, code: str, context: ScanContext) -> Optional[ScanResult]:
        """
        Valida un código escaneado.

        Args:
            code: String crudo del scanner.
            context: Contexto del escaneo (módulo, producto conocido, etc).

        Returns:
            ScanResult si el código fue identificado, None si no aplica.
        """
        ...
