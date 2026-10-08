"""
Servicio para generar códigos de barras propios para unidades trazables.
"""
from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from src.models.inventory import (
    BarcodeSequence,
    Product,
    ProductType,
    SerialItem,
    SerialItemStatus,
)


class BarcodeGeneratorService:
    """Genera códigos CODE128 y crea SerialItem para unidades trazables."""

    def _infer_prefix(self, product: Product) -> str:
        haystack = f"{product.name or ''} {product.sku or ''}".upper()

        if "DROP" in haystack:
            return "DRP"
        if "FIBRA" in haystack or "FIBER" in haystack:
            return "FBR"
        if "CABLE" in haystack:
            return "CBL"
        if "CONECTOR" in haystack:
            return "CNT"

        return "TRK"

    def _reserve_codes(self, prefix: str, year: int, count: int, db: Session) -> List[str]:
        # Bloqueo explícito por fila para secuencia prefix+year sin depender de joins ORM.
        seq_row = db.execute(
            select(BarcodeSequence.id, BarcodeSequence.last_sequence)
            .where(BarcodeSequence.prefix == prefix, BarcodeSequence.year == year)
            .with_for_update()
        ).first()

        if seq_row is None:
            seq = BarcodeSequence(prefix=prefix, year=year, last_sequence=0)
            db.add(seq)
            db.flush()
            seq_id = seq.id
            last_sequence = 0
        else:
            seq_id = seq_row.id
            last_sequence = seq_row.last_sequence

        codes: List[str] = []
        for _ in range(count):
            # En caso de colisión inesperada por datos legacy, seguimos avanzando.
            while True:
                last_sequence += 1
                code = f"{prefix}-{year}-{last_sequence:05d}"
                exists = db.execute(
                    select(SerialItem.id).where(SerialItem.serial_number == code)
                ).first()
                if not exists:
                    codes.append(code)
                    break

        db.execute(
            update(BarcodeSequence)
            .where(BarcodeSequence.id == seq_id)
            .values(last_sequence=last_sequence, updated_at=datetime.utcnow())
        )

        return codes

    def generate_batch(
        self,
        product_id: int,
        count: int,
        warehouse_id: int,
        db: Session,
    ) -> List[SerialItem]:
        """
        Genera N códigos y crea N SerialItem en estado NEW para el almacén destino.
        """
        if count <= 0:
            raise ValueError("count debe ser mayor a 0")

        product = db.get(Product, product_id)
        if not product:
            raise ValueError(f"Producto {product_id} no encontrado")

        if product.type != ProductType.BULK:
            raise ValueError("Solo productos BULK compuestos pueden serializarse con códigos propios")

        if not product.is_composite:
            raise ValueError("El producto no está marcado como compuesto")

        if not product.unit_size or product.unit_size <= 0:
            raise ValueError("El producto compuesto debe tener unit_size válido")

        prefix = self._infer_prefix(product)
        year = datetime.utcnow().year
        codes = self._reserve_codes(prefix=prefix, year=year, count=count, db=db)

        # Guardamos el último producto asociado para trazabilidad de la secuencia.
        db.execute(
            update(BarcodeSequence)
            .where(BarcodeSequence.prefix == prefix, BarcodeSequence.year == year)
            .values(product_id=product_id, updated_at=datetime.utcnow())
        )

        created: List[SerialItem] = []
        for code in codes:
            serial_item = SerialItem(
                serial_number=code,
                product_id=product_id,
                warehouse_id=warehouse_id,
                status=SerialItemStatus.NEW,
                is_generated_barcode=True,
                initial_quantity=product.unit_size,
                remaining_quantity=product.unit_size,
            )
            db.add(serial_item)
            created.append(serial_item)

        db.flush()
        return created

    # Zona de silencio (quiet zone) exigida por el estándar Code 128:
    # 10 módulos en cada extremo.
    _QUIET_ZONE_MODULES = 10

    @staticmethod
    def _build_barcode_row(binary: str, quiet_modules: int, module_px: int) -> bytes:
        """Empaqueta una fila 1-bit (MSB primero, 0=negro, 1=blanco)."""
        width = (len(binary) + 2 * quiet_modules) * module_px
        row = bytearray([0xFF] * ((width + 7) // 8))
        start = quiet_modules * module_px

        for i, ch in enumerate(binary):
            if ch == "1":
                x0 = start + i * module_px
                for x in range(x0, x0 + module_px):
                    row[x // 8] &= ~(1 << (7 - (x % 8)))

        return bytes(row)

    def render_png(
        self,
        barcode_string: str,
        module_px: int = 2,
        height_px: int = 64,
        dpi: int = 96,
    ):
        """Renderiza un barcode CODE128 como PNG 1-bit de geometría exacta.

        Cada módulo ocupa `module_px` píxeles enteros (2 px ≈ 0.53 mm a
        96 dpi). Devuelve ``(png_bytes, width_px, height_px)``.

        El frontend debe mostrarlo a su tamaño natural en píxeles (1:1):
        así el navegador NO reescalea la imagen. El reescalado (de vectores
        o de bitmaps con ancho en mm) era lo que degradaba el guion y lo
        convertía en apóstrofe al escanear.
        """
        import barcode

        from src.utils.barcode_png import encode_1bit_png

        code128 = barcode.get_barcode_class("code128")
        binary = code128(barcode_string).build()[0]

        width_px = (len(binary) + 2 * self._QUIET_ZONE_MODULES) * module_px
        height_px = max(1, int(height_px))

        row = self._build_barcode_row(binary, self._QUIET_ZONE_MODULES, module_px)
        png = encode_1bit_png(width_px, height_px, row, dpi=dpi)

        return png, width_px, height_px
