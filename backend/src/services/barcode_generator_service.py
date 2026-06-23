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

    def render_svg(self, barcode_string: str) -> str:
        """Renderiza un barcode CODE128 en SVG crudo (XML)."""
        import barcode
        from barcode.writer import SVGWriter

        code128 = barcode.get_barcode_class("code128")
        writer = SVGWriter()
        svg = code128(barcode_string, writer=writer).render(writer_options={"write_text": False})

        if isinstance(svg, bytes):
            return svg.decode("utf-8")
        return str(svg)
