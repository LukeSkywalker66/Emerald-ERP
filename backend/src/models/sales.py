"""
Sales Models - Ventas al Público (acción de stock).

En esta etapa el módulo solo registra la SALIDA DE STOCK por venta: un producto
vendido deja de estar disponible. La facturación, el precio, el cliente formal y
los pagos son capas comerciales futuras que se colgarán de `Sale` sin remodelar.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, List

from sqlalchemy import (
    Integer, String, Float, DateTime, Text, ForeignKey, Enum, text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class SaleStatus(str, PyEnum):
    """Estados de una venta."""
    DRAFT = "DRAFT"          # Armado, aún no confirmado
    CONFIRMED = "CONFIRMED"  # Confirmado: stock ya descontado
    CANCELLED = "CANCELLED"  # Anulado (solo en DRAFT)


class Sale(Base):
    """
    Encabezado de una venta al público.

    Es un documento comercial liviano que descuenta stock del depósito de origen.
    No tiene precio ni pago ni cliente formal en esta etapa; `reference` es un
    texto libre (nombre/DNI del comprador, comprobante externo, etc.).
    """
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sale_number: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True,
        index=True,
        comment="Correlativo legible de la venta (VTA-YYYY-NNNNN)"
    )
    warehouse_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Depósito que descuenta stock"
    )
    status: Mapped[SaleStatus] = mapped_column(
        Enum(SaleStatus, name="sale_status_enum", native_enum=False),
        nullable=False,
        default=SaleStatus.DRAFT,
        index=True,
        comment="DRAFT | CONFIRMED | CANCELLED"
    )
    reference: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Texto libre: nombre/DNI del comprador, comprobante externo, etc."
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    seller_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Usuario que registró la venta"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow
    )

    # Relaciones
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", lazy="joined")
    seller: Mapped[Optional["User"]] = relationship("User", lazy="joined")
    items: Mapped[List["SaleItem"]] = relationship(
        "SaleItem",
        back_populates="sale",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self):
        return f"<Sale(id={self.id}, number='{self.sale_number}', status={self.status.value})>"


class SaleItem(Base):
    """
    Línea de una venta.

    Para productos SERIALIZED, `serial_item_id` es obligatorio y `quantity` es 1.
    Para BULK, `quantity` es la cantidad vendida.
    """
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sale_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    quantity: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=1,
        comment="Cantidad vendida (1 para SERIALIZED)"
    )
    serial_item_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("serial_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Serial vendido (obligatorio si el producto es SERIALIZED)"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relaciones
    sale: Mapped["Sale"] = relationship("Sale", back_populates="items")
    product: Mapped["Product"] = relationship("Product", lazy="joined")
    serial_item: Mapped[Optional["SerialItem"]] = relationship("SerialItem", lazy="joined")

    def __repr__(self):
        return f"<SaleItem(id={self.id}, sale={self.sale_id}, product={self.product_id})>"
