"""
Logistics Models - Gestión de entregas y recepciones de materiales.
Soporta la transferencia inteligente de materiales desde depósito central
a móviles de cuadrillas, con propuestas basadas en OT programadas.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, ForeignKey,
    Enum, UniqueConstraint, Index, text, Boolean
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.database import Base


class DeliveryStatus(str, PyEnum):
    """Estados de una entrega de materiales."""
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class DeliveryItemSource(str, PyEnum):
    """Origen de un item en la entrega."""
    PROPOSAL = "PROPOSAL"  # Sugerido por el sistema
    MANUAL = "MANUAL"      # Agregado manualmente por el operador


class ReceiptItemCondition(str, PyEnum):
    """Condición de un material recibido."""
    GOOD = "GOOD"
    DEFECTIVE = "DEFECTIVE"
    DAMAGED = "DAMAGED"


class MaterialDelivery(Base):
    """
    Entrega de materiales a una cuadrilla.
    Representa la transferencia física de materiales desde el depósito
    central al almacén móvil de un vehículo de cuadrilla.
    """
    __tablename__ = "material_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("teams.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Cuadrilla destinataria"
    )
    warehouse_from_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Depósito central de origen"
    )
    warehouse_to_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Almacén móvil de destino"
    )
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, name="delivery_status_enum", native_enum=False),
        nullable=False,
        default=DeliveryStatus.DRAFT,
        index=True,
        comment="Estado de la entrega"
    )
    proposal_generated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        comment="Timestamp de la última generación de propuesta"
    )
    delivered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        comment="Fecha/hora de entrega efectiva"
    )
    delivered_by_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Usuario que realizó la entrega"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    team: Mapped["Team"] = relationship("Team", lazy="joined")
    warehouse_from: Mapped["Warehouse"] = relationship(
        "Warehouse", foreign_keys=[warehouse_from_id], lazy="joined"
    )
    warehouse_to: Mapped["Warehouse"] = relationship(
        "Warehouse", foreign_keys=[warehouse_to_id], lazy="joined"
    )
    delivered_by: Mapped["User"] = relationship("User", lazy="joined")
    items: Mapped[List["MaterialDeliveryItem"]] = relationship(
        "MaterialDeliveryItem", back_populates="delivery",
        cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self):
        return f"<MaterialDelivery(id={self.id}, team={self.team_id}, status={self.status.value})>"


class MaterialDeliveryItem(Base):
    """
    Item individual dentro de una entrega de materiales.
    Registra qué producto, cantidad propuesta vs entregada, y si fue
    sugerido por el sistema o agregado manualmente.
    """
    __tablename__ = "material_delivery_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    delivery_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("material_deliveries.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Producto del catálogo"
    )
    quantity_proposed: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0,
        comment="Cantidad sugerida por el sistema"
    )
    quantity_delivered: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0,
        comment="Cantidad real entregada (puede diferir de la propuesta)"
    )
    is_serialized: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Si el producto es serializado"
    )
    serial_item_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("serial_items.id", ondelete="SET NULL"),
        nullable=True,
        comment="Serial específico (si es serializado)"
    )
    serial_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Número de serie (redundancia para consultas rápidas)"
    )
    source: Mapped[DeliveryItemSource] = mapped_column(
        Enum(DeliveryItemSource, name="delivery_item_source_enum", native_enum=False),
        nullable=False,
        default=DeliveryItemSource.PROPOSAL,
        comment="Origen: PROPOSAL (sugerido) o MANUAL (agregado por operador)"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # Relaciones
    delivery: Mapped["MaterialDelivery"] = relationship(
        "MaterialDelivery", back_populates="items"
    )
    product: Mapped["Product"] = relationship("Product", lazy="joined")
    serial_item: Mapped[Optional["SerialItem"]] = relationship(
        "SerialItem", lazy="joined"
    )

    def __repr__(self):
        return f"<MaterialDeliveryItem(id={self.id}, delivery={self.delivery_id}, product={self.product_id})>"


class MaterialReceipt(Base):
    """
    Recepción de materiales devueltos a central.
    Cuando una cuadrilla regresa materiales sobrantes, defectuosos o
    para redistribución, se registra mediante este modelo.
    """
    __tablename__ = "material_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("teams.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Cuadrilla que devuelve los materiales"
    )
    warehouse_from_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Almacén móvil de origen"
    )
    warehouse_to_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Depósito central de destino"
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="Fecha/hora de recepción"
    )
    received_by_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Usuario que recibió los materiales"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # Relaciones
    team: Mapped["Team"] = relationship("Team", lazy="joined")
    warehouse_from: Mapped["Warehouse"] = relationship(
        "Warehouse", foreign_keys=[warehouse_from_id], lazy="joined"
    )
    warehouse_to: Mapped["Warehouse"] = relationship(
        "Warehouse", foreign_keys=[warehouse_to_id], lazy="joined"
    )
    received_by: Mapped["User"] = relationship("User", lazy="joined")
    items: Mapped[List["MaterialReceiptItem"]] = relationship(
        "MaterialReceiptItem", back_populates="receipt",
        cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self):
        return f"<MaterialReceipt(id={self.id}, team={self.team_id})>"


class MaterialReceiptItem(Base):
    """
    Item individual dentro de una recepción de materiales.
    """
    __tablename__ = "material_receipt_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    receipt_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("material_receipts.id", ondelete="CASCADE"),
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
        comment="Cantidad recibida"
    )
    serial_item_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("serial_items.id", ondelete="SET NULL"),
        nullable=True
    )
    serial_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Número de serie (redundancia)"
    )
    condition: Mapped[ReceiptItemCondition] = mapped_column(
        Enum(ReceiptItemCondition, name="receipt_item_condition_enum", native_enum=False),
        nullable=False,
        default=ReceiptItemCondition.GOOD,
        comment="Condición del material: GOOD, DEFECTIVE, DAMAGED"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # Relaciones
    receipt: Mapped["MaterialReceipt"] = relationship(
        "MaterialReceipt", back_populates="items"
    )
    product: Mapped["Product"] = relationship("Product", lazy="joined")
    serial_item: Mapped[Optional["SerialItem"]] = relationship(
        "SerialItem", lazy="joined"
    )

    def __repr__(self):
        return f"<MaterialReceiptItem(id={self.id}, receipt={self.receipt_id}, product={self.product_id})>"
