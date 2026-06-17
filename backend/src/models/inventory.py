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
    Enum, UniqueConstraint, Index, text, Boolean
)
from sqlalchemy.dialects.postgresql import JSONB
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
    AUXILIAR = "AUXILIAR"    # Depósito auxiliar/secundario


class ProductType(str, PyEnum):
    """Tipos de producto según seguimiento."""
    SERIALIZED = "SERIALIZED"  # Equipos con serial único (ONUs, routers)
    BULK = "BULK"              # Materiales a granel (cable por metros, conectores)


class SerialItemStatus(str, PyEnum):
    """Estados de items serializados."""
    NEW = "NEW"              # Depósito central, nuevo sin usar
    IN_VEHICLE = "IN_VEHICLE"  # En camioneta de técnico (stock móvil)
    INSTALLED = "INSTALLED"  # Instalado en cliente
    DEFECTIVE = "DEFECTIVE"  # Devuelto por técnico como defectuoso
    DAMAGED = "DAMAGED"      # Evaluado en central como no reparable
    DECOMMISSIONED = "DECOMMISSIONED"  # Baja definitiva (solo central)


class MovementType(str, PyEnum):
    """Tipos de movimientos de stock."""
    PURCHASE = "PURCHASE"        # Compra/ingreso
    TRANSFER = "TRANSFER"        # Traspaso entre depósitos
    CONSUMPTION = "CONSUMPTION"  # Uso en OT
    RECOVERY = "RECOVERY"        # Recupero de campo
    ADJUSTMENT = "ADJUSTMENT"    # Ajuste de inventario


class UnitMeasure(str, PyEnum):
    """Unidades de medida para productos compuestos."""
    METERS = "m"           # Metros (cable, drop, UTP)
    UNITS = "units"        # Unidades (conectores, grampas)
    PIECES = "pcs"         # Piezas individuales


class DeliveryStatus(str, PyEnum):
    """Estados de una entrega de materiales."""
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ReceiptItemCondition(str, PyEnum):
    """Condición de un material recibido."""
    GOOD = "GOOD"
    DEFECTIVE = "DEFECTIVE"
    DAMAGED = "DAMAGED"


class PurchaseStatus(str, PyEnum):
    """Estados de una compra."""
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# ============================================
# MODELOS
# ============================================


class ProductCategory(Base):
    """
    Catálogo de categorías de productos.
    Tabla de referencia poblada con valores semilla:
    Cableado, Equipos, Accesorios, Herramientas.
    """
    __tablename__ = "product_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="Nombre de la categoría (Ej: Cableado, Equipos)"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="Si la categoría está disponible para nuevos productos"
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

    def __repr__(self):
        return f"<ProductCategory(id={self.id}, name='{self.name}')>"


class ProductGroup(Base):
    """
    Agrupación de productos del mismo rubro.
    Ej: ONU/ONT, Router Domiciliario, Conectores, Cableado.
    Permite filtrado y aplicar especificaciones técnicas comunes.
    """
    __tablename__ = "product_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="Nombre del grupo (Ej: ONU/ONT, Router Domiciliario)"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Descripción del grupo"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="Si el grupo está disponible para nuevos productos"
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
    products: Mapped[List["Product"]] = relationship(
        "Product", back_populates="group", lazy="select"
    )

    def __repr__(self):
        return f"<ProductGroup(id={self.id}, name='{self.name}')>"


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
        comment="[DEPRECATED] Usar Team + Vehicle en su lugar"
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

    # ========== NUEVA RELACIÓN INVERSA: Vehicle ==========
    vehicle: Mapped[Optional["Vehicle"]] = relationship(
        "Vehicle",
        back_populates="warehouse",
        lazy="selectin",
        uselist=False,
        foreign_keys="Vehicle.warehouse_id"
    )

    def __repr__(self):
        return f"<Warehouse(id={self.id}, name='{self.name}', type={self.type.value})>"


class Product(Base):
    """
    Catálogo de productos.
    Define si un producto requiere seguimiento por serial o es a granel,
    su agrupación lógica (grupo), y si es un producto compuesto (fraccionable).
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

    # ========== NUEVOS CAMPOS: Agrupación ==========
    group_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("product_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Grupo lógico de producto (ONU/ONT, Router, Conectores, etc)"
    )

    # ========== NUEVOS CAMPOS: Fraccionamiento ==========
    unit_size: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Tamaño de 1 unidad compuesta (ej: 300 para bobina drop, 10 para blister conectores)"
    )
    unit_measure: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Unidad de medida (m, units, pcs)"
    )
    is_composite: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="True si se compra entero pero se consume fraccionadamente (ej: bobina, blister)"
    )
    composite_unit_label: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Etiqueta de la unidad compuesta (ej: Bobina, Blister, Cajita)"
    )

    # ========== NUEVO: Validación de seriales ==========
    serial_validation_regex: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Regex para validar seriales al ingresar compras. Null = acepta cualquier formato."
    )

    min_stock_alert: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        server_default="0",
        comment="Cantidad mínima antes de alertar (en unidades del stock del producto)"
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
    group: Mapped[Optional["ProductGroup"]] = relationship(
        "ProductGroup", back_populates="products", lazy="joined"
    )
    spec: Mapped[Optional["ProductSpec"]] = relationship(
        "ProductSpec", back_populates="product",
        uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )
    stock_bulk: Mapped[List["StockBulk"]] = relationship("StockBulk", back_populates="product", cascade="all, delete-orphan")
    serial_items: Mapped[List["SerialItem"]] = relationship("SerialItem", back_populates="product", cascade="all, delete-orphan")
    movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="product")

    def __repr__(self):
        return f"<Product(id={self.id}, sku='{self.sku}', name='{self.name}', type={self.type.value})>"


class ProductSpec(Base):
    """
    Especificaciones técnicas dinámicas de un producto.
    Almacena atributos en JSONB según el grupo del producto.
    
    Ej ONU/ONT:  { "is_dual_band": true, "wifi_version": "6", "mode": "router_bridge" }
    Ej Router:   { "is_mesh": false, "is_dual_band": true, "ports": "4xGE", "extra_notes": "..." }
    """
    __tablename__ = "product_specs"

    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
        comment="FK a products (1:1)"
    )
    specs: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Especificaciones técnicas en formato JSONB (atributos dinámicos según grupo)"
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
    product: Mapped["Product"] = relationship("Product", back_populates="spec")

    def __repr__(self):
        return f"<ProductSpec(product_id={self.product_id}, specs={self.specs})>"


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
        comment="Cantidad stockeada (para compuestos = unidades compuestas; para no compuestos = unidad natural del producto)"
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
    is_generated_barcode: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="True si el código fue generado por Emerald (no serial OEM)"
    )
    initial_quantity: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Cantidad inicial para unidades compuestas (ej: 300m)"
    )
    remaining_quantity: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Saldo restante para unidades compuestas (ej: 150m)"
    )
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
        comment="Ubicación actual del item. CENTRAL/MOBILE/VIRTUAL (instalado en cliente)"
    )
    status: Mapped[SerialItemStatus] = mapped_column(
        Enum(SerialItemStatus, name="serial_item_status_enum", native_enum=False),
        nullable=False,
        server_default="NEW",
        index=True
    )
    connection_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("connections.connection_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Conexión donde está instalado este equipo (si status=INSTALLED)"
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
    consumption_logs: Mapped[List["ConsumptionLog"]] = relationship(
        "ConsumptionLog",
        back_populates="tracked_unit",
        cascade="all, delete-orphan"
    )

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


class BarcodeSequence(Base):
    """
    Secuencia para generación de códigos de barra propios por prefijo y año.
    """
    __tablename__ = "barcode_sequences"
    __table_args__ = (
        UniqueConstraint("prefix", "year", name="uq_barcode_seq_prefix_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Producto asociado a la secuencia (opcional)"
    )
    prefix: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="Prefijo legible (ej: BOB, CNT, CBL)"
    )
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="Año de la secuencia"
    )
    last_sequence: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
        comment="Último correlativo utilizado"
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

    product: Mapped[Optional["Product"]] = relationship("Product", lazy="joined")

    def __repr__(self):
        return (
            f"<BarcodeSequence(id={self.id}, prefix='{self.prefix}', year={self.year}, "
            f"last_sequence={self.last_sequence})>"
        )


class ConsumptionLog(Base):
    """
    Historial de consumo fraccionado para unidades trazables.
    """
    __tablename__ = "consumption_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tracked_unit_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("serial_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Unidad trazable consumida (serial_items.id)"
    )
    work_order_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="OT donde se registró el consumo"
    )
    quantity_consumed: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Cantidad consumida en unidades base"
    )
    quantity_before: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Saldo antes del consumo"
    )
    quantity_after: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Saldo después del consumo"
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Usuario que registró el consumo"
    )
    warehouse_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Almacén donde ocurrió el consumo"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True
    )

    tracked_unit: Mapped["SerialItem"] = relationship("SerialItem", back_populates="consumption_logs")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", foreign_keys=[warehouse_id], lazy="joined")

    def __repr__(self):
        return (
            f"<ConsumptionLog(id={self.id}, tracked_unit_id={self.tracked_unit_id}, "
            f"consumed={self.quantity_consumed}, after={self.quantity_after})>"
        )


class SerialFormat(Base):
    """
    Diccionario de formatos de número de serie por producto.
    Permite configurar patrones regex por producto para que el
    BarcodeScannerEngine valide seriales sin hardcodeo.

    Si no hay patrón registrado para un producto, el motor cae a
    validación por grupo (ITU-T G.984 para ONU/ONT) o genérica.
    """
    __tablename__ = "serial_formats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Producto asociado al patrón"
    )
    regex_pattern: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Patrón regex que debe cumplir el SN (ej: ^[A-Z0-9]{4}[A-Z0-9]{8}$)"
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Descripción legible del patrón"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="Si el patrón está activo para validación"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # Relaciones
    product: Mapped["Product"] = relationship("Product", lazy="joined")

    __table_args__ = (
        UniqueConstraint("product_id", name="uq_serial_format_product"),
    )

    def __repr__(self):
        return (
            f"<SerialFormat(id={self.id}, product_id={self.product_id}, "
            f"pattern='{self.regex_pattern}')>"
        )


class PurchaseScanSession(Base):
    """
    Sesión de escaneo activa para una compra/ingreso de stock.

    Mantiene el estado de una sesión de escaneo de seriales:
    - Lista de SNs escaneados (para deduplicación)
    - Contador en tiempo real
    - Referencia y notas de la compra

    Al confirmar, se ejecuta el ingreso masivo de serial_items + stock_movements.
    """
    __tablename__ = "purchase_scan_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    warehouse_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Almacén destino de los seriales"
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Producto serializado que se está escaneando"
    )
    scanned_sns: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        comment="Array de strings con SNs escaneados (para dedup)"
    )
    count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Contador de seriales ingresados"
    )
    is_complete: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True cuando el operador confirma la carga"
    )
    reference: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Referencia de la compra (factura, orden, remito)"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notas adicionales de la compra"
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Usuario que realiza la compra"
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
    product: Mapped["Product"] = relationship("Product", lazy="joined")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", lazy="joined")

    def __repr__(self):
        return (
            f"<PurchaseScanSession(id={self.id}, product_id={self.product_id}, "
            f"count={self.count}, complete={self.is_complete})>"
        )


class ConnectionAssetStatus(str, PyEnum):
    """Estados de un activo registrado en una conexión."""
    INSTALLED = "INSTALLED"    # Actualmente instalado en el cliente
    REMOVED = "REMOVED"        # Fue retirado (reemplazado, dañado, etc.)


class ConnectionAsset(Base):
    """
    Registro de equipos serializados instalados/retirados de una conexión.
    Permite tener un historial completo de qué equipos tuvo cada cliente.

    Solo aplica a productos SERIALIZED. Los BULK se trackean en work_order_items.
    """
    __tablename__ = "connection_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    connection_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("connections.connection_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Conexión donde se instaló/retiró el equipo"
    )
    serial_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("serial_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Item serializado asociado"
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Producto del catálogo (para JOIN directo)"
    )
    serial_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Serial del equipo (redundancia para consultas rápidas)"
    )
    status: Mapped[ConnectionAssetStatus] = mapped_column(
        String(50),
        nullable=False,
        default=ConnectionAssetStatus.INSTALLED.value,
        comment="INSTALLED: activo, REMOVED: retirado"
    )
    installed_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="Fecha de instalación"
    )
    removed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        comment="Fecha de retiro (si aplica)"
    )
    installed_by_wo_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
        comment="OT que instaló este equipo"
    )
    removed_by_wo_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
        comment="OT que retiró este equipo"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Observaciones sobre el estado del equipo al instalar/retirar"
    )

    # Relaciones
    serial_item: Mapped["SerialItem"] = relationship("SerialItem", foreign_keys=[serial_item_id])
    installed_by_wo: Mapped[Optional["WorkOrder"]] = relationship(
        "WorkOrder", foreign_keys=[installed_by_wo_id], lazy="joined"
    )
    removed_by_wo: Mapped[Optional["WorkOrder"]] = relationship(
        "WorkOrder", foreign_keys=[removed_by_wo_id], lazy="joined"
    )

    __table_args__ = (
        Index("ix_connection_assets_lookup", "connection_id", "serial_item_id", unique=True),
    )

    def __repr__(self):
        return f"<ConnectionAsset(id={self.id}, conn={self.connection_id}, serial='{self.serial_number}', status={self.status})>"


class ConnectionNote(Base):
    """
    Notas de los técnicos sobre una conexión específica.
    Observaciones libres que quedan como referencia para futuras visitas.
    Ej: "Cliente con 3 pisos", "Perro peligroso", "Red aerea saturada".
    """
    __tablename__ = "connection_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    connection_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("connections.connection_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Conexión asociada"
    )
    work_order_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
        comment="OT que generó esta nota"
    )
    author_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Técnico que escribió la nota"
    )
    note: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Contenido de la nota"
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Nota importante/pinned (visible siempre)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True
    )

    def __repr__(self):
        return f"<ConnectionNote(id={self.id}, conn={self.connection_id}, pinned={self.is_pinned})>"
