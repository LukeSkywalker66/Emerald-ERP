"""
Inventory Models - Gestión de Inventario Operativo
Soporta almacenes móviles (camionetas) y seguimiento de seriales.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, ForeignKey,
    Enum, UniqueConstraint, Index, text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.database import Base


# ============================================
# ENUMS
# ============================================

class WarehouseType(str, PyEnum):
    """Tipos de almacén/depósito."""
    CENTRAL = "CENTRAL"      # Depósito principal
    MOBILE = "MOBILE"        # Camioneta de técnico
    VIRTUAL = "VIRTUAL"      # Para bajas, perdidos, clientes


class ProductType(str, PyEnum):
    """Tipos de producto según seguimiento."""
    SERIALIZED = "SERIALIZED"  # Equipos con serial único (ONUs, routers)
    BULK = "BULK"              # Materiales a granel (cable por metros, conectores)


class SerialItemStatus(str, PyEnum):
    """Estados de items serializados."""
    NEW = "NEW"              # Nuevo sin usar
    USED = "USED"            # Usado funcionando
    DAMAGED = "DAMAGED"      # Dañado/no funcional
    INSTALLED = "INSTALLED"  # Instalado en campo


class MovementType(str, PyEnum):
    """Tipos de movimientos de stock."""
    PURCHASE = "PURCHASE"        # Compra/ingreso
    TRANSFER = "TRANSFER"        # Traspaso entre depósitos
    CONSUMPTION = "CONSUMPTION"  # Uso en OT
    RECOVERY = "RECOVERY"        # Recupero de campo
    ADJUSTMENT = "ADJUSTMENT"    # Ajuste de inventario


# ============================================
# MODELOS
# ============================================

class Warehouse(Base):
    """
    Depósitos/Ubicaciones de stock.
    Soporta almacenes físicos, móviles (camionetas) y virtuales.
    """
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[WarehouseType] = mapped_column(
        Enum(WarehouseType, name="warehouse_type_enum", native_enum=False),
        nullable=False,
        index=True,
        comment="CENTRAL: depósito principal, MOBILE: camioneta de técnico, VIRTUAL: bajas/perdidos/clientes"
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="FK a usuario si es tipo MOBILE (técnico asignado)"
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
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id], lazy="joined")
    stock_bulk: Mapped[List["StockBulk"]] = relationship("StockBulk", back_populates="warehouse", cascade="all, delete-orphan")
    serial_items: Mapped[List["SerialItem"]] = relationship("SerialItem", back_populates="warehouse")
    movements_from: Mapped[List["StockMovement"]] = relationship(
        "StockMovement",
        foreign_keys="StockMovement.from_warehouse_id",
        back_populates="from_warehouse"
    )
    movements_to: Mapped[List["StockMovement"]] = relationship(
        "StockMovement",
        foreign_keys="StockMovement.to_warehouse_id",
        back_populates="to_warehouse"
    )

    def __repr__(self):
        return f"<Warehouse(id={self.id}, name='{self.name}', type={self.type.value})>"


class Product(Base):
    """
    Catálogo de productos.
    Define si un producto requiere seguimiento por serial o es a granel.
    """
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sku: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
        comment="Código corto único"
    )
    type: Mapped[ProductType] = mapped_column(
        Enum(ProductType, name="product_type_enum", native_enum=False),
        nullable=False,
        index=True,
        comment="SERIALIZED: equipos con serial único, BULK: materiales a granel"
    )
    category: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Ej: ONU, CABLE, HERRAMIENTA"
    )
    min_stock_alert: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
        comment="Cantidad mínima antes de alertar"
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    stock_bulk: Mapped[List["StockBulk"]] = relationship("StockBulk", back_populates="product", cascade="all, delete-orphan")
    serial_items: Mapped[List["SerialItem"]] = relationship("SerialItem", back_populates="product", cascade="all, delete-orphan")
    movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="product")

    def __repr__(self):
        return f"<Product(id={self.id}, sku='{self.sku}', name='{self.name}', type={self.type.value})>"


class StockBulk(Base):
    """
    Existencias de productos a granel por almacén.
    Un producto solo puede aparecer una vez por almacén (constraint unique).
    """
    __tablename__ = "stock_bulk"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "product_id", name="uq_stock_bulk_warehouse_product"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    warehouse_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    quantity: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        server_default="0",
        comment="Puede ser metros de cable, unidades, etc."
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
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="stock_bulk")
    product: Mapped["Product"] = relationship("Product", back_populates="stock_bulk")

    def __repr__(self):
        return f"<StockBulk(warehouse_id={self.warehouse_id}, product_id={self.product_id}, qty={self.quantity})>"


class SerialItem(Base):
    """
    Items con serial único (ONUs, routers, etc).
    Cada equipo se rastrea individualmente.
    """
    __tablename__ = "serial_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    serial_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True
    )
    mac_address: Mapped[Optional[str]] = mapped_column(String(17), nullable=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    warehouse_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Ubicación actual del item"
    )
    status: Mapped[SerialItemStatus] = mapped_column(
        Enum(SerialItemStatus, name="serial_item_status_enum", native_enum=False),
        nullable=False,
        server_default="NEW",
        index=True
    )
    ticket_related_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
        comment="Última OT/Ticket donde se usó este item"
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
    product: Mapped["Product"] = relationship("Product", back_populates="serial_items")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="serial_items")
    ticket_related: Mapped[Optional["Ticket"]] = relationship("Ticket", foreign_keys=[ticket_related_id])
    movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="serial_item")

    def __repr__(self):
        return f"<SerialItem(id={self.id}, serial='{self.serial_number}', status={self.status.value})>"


class StockMovement(Base):
    """
    Bitácora de auditoría de movimientos de stock.
    Registra todos los cambios: compras, transferencias, consumos, etc.
    """
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    from_warehouse_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Origen del movimiento (null si es compra/alta)"
    )
    to_warehouse_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Destino del movimiento (null si es baja/consumo)"
    )
    quantity: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Cantidad si es producto BULK"
    )
    serial_item_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("serial_items.id", ondelete="SET NULL"),
        nullable=True,
        comment="Serial específico si es producto SERIALIZED"
    )
    movement_type: Mapped[MovementType] = mapped_column(
        Enum(MovementType, name="movement_type_enum", native_enum=False),
        nullable=False,
        index=True,
        comment="PURCHASE: compra/ingreso, TRANSFER: traspaso, CONSUMPTION: uso en OT, RECOVERY: recupero, ADJUSTMENT: ajuste"
    )
    reference: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Ej: 'OT #123', 'Remito #50', 'Ajuste manual'"
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Usuario que realizó el movimiento"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relaciones
    product: Mapped["Product"] = relationship("Product", back_populates="movements")
    from_warehouse: Mapped[Optional["Warehouse"]] = relationship(
        "Warehouse",
        foreign_keys=[from_warehouse_id],
        back_populates="movements_from"
    )
    to_warehouse: Mapped[Optional["Warehouse"]] = relationship(
        "Warehouse",
        foreign_keys=[to_warehouse_id],
        back_populates="movements_to"
    )
    serial_item: Mapped[Optional["SerialItem"]] = relationship("SerialItem", back_populates="movements")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<StockMovement(id={self.id}, type={self.movement_type.value}, product_id={self.product_id})>"
