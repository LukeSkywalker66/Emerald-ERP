"""Model for WorkOrderType configuration (DB-driven labels) and WO Templates."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class WorkOrderTypeConfig(Base):
    """Configurable work order type with DB-driven labels, colors and icons.

    This replaces hardcoded dictionaries across the frontend so that labels
    can be changed without redeploying code.
    """

    __tablename__ = "work_order_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Display label (Spanish)"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(
        String(50), default="bg-zinc-600",
        comment="Tailwind CSS class for card background"
    )
    icon: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="Lucide icon name (e.g. Wrench, Package)"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:
        return f"<WorkOrderTypeConfig(id={self.id}, code='{self.code}', name='{self.name}')>"


class WOTemplate(Base):
    """
    Plantilla de materiales sugeridos por tipo de visita de OT.
    Permite a los admins configurar listas de productos recomendados
    que aparecen precargados (editables) cuando el técnico abre el
    selector de materiales.

    Ejemplos:
      - "Instalación FTTH Mínima": ONU (1), Drop (30m), Conectores verdes (2)
      - "Instalación Antena": Router (1), UTP (10m), RJ45 (2)
      - "Reemplazo ONU": ONU (1)
    """
    __tablename__ = "wo_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="Nombre descriptivo de la plantilla"
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Descripción de cuándo usar esta plantilla"
    )
    ot_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True,
        comment="Tipo de OT al que aplica (install, repair, etc.)"
    )
    action_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True,
        comment="Acción de resolución a la que aplica (realizada, reconfig, etc.)"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relaciones
    items: Mapped[list["WOTemplateItem"]] = relationship(
        "WOTemplateItem", back_populates="template",
        cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<WOTemplate(id={self.id}, name='{self.name}')>"


class WOTemplateItem(Base):
    """
    Producto individual dentro de una plantilla de materiales.
    Define qué producto (o grupo de producto), cantidad por defecto, y si es obligatorio.
    
    Puede referenciar:
    - Un producto específico (product_id)
    - O un grupo de producto (group_id) — útil para decir "1 ONT" sin especificar modelo
    
    Ambos son mutuamente excluyentes: si se especifica group_id, se ignora product_id.
    """
    __tablename__ = "wo_template_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("wo_templates.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=True, index=True,
        comment="Producto específico del catálogo (opcional si se usa group_id)"
    )
    group_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("product_groups.id", ondelete="SET NULL"),
        nullable=True, index=True,
        comment="Grupo de producto (ej: ONU/ONT). Alternativa a product_id para referencias genéricas"
    )
    default_quantity: Mapped[float] = mapped_column(
        Float, default=1.0, nullable=False,
        comment="Cantidad sugerida por defecto"
    )
    required: Mapped[bool] = mapped_column(
        Boolean, default=False,
        comment="Si el técnico debe incluir este producto sí o sí"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, default=0,
        comment="Orden de aparición en la lista"
    )
    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Nota interna sobre este item en la plantilla"
    )

    # Relaciones
    template: Mapped["WOTemplate"] = relationship(
        "WOTemplate", back_populates="items"
    )
    product: Mapped[Optional["Product"]] = relationship(
        "Product", lazy="joined"
    )
    group: Mapped[Optional["ProductGroup"]] = relationship(
        "ProductGroup", lazy="joined"
    )

    def __repr__(self) -> str:
        return f"<WOTemplateItem(id={self.id}, tmpl={self.template_id}, prod={self.product_id}, group={self.group_id})>"


class WOAction(Base):
    """
    Acciones de resolución configurables por tipo de OT.
    Define qué acciones puede realizar un técnico al completar una OT,
    agrupadas por tipo de OT.

    Built-in: 'realizada' (completada exitosamente) y 'no_realizada' (no se pudo realizar).
    - 'no_realizada' existe para TODOS los tipos de OT y siempre requiere notas.
    - 'realizada' existe para tipos simples (install, pickup, infrastructure).
    - repair tiene acciones específicas (reconfig, replacement, etc).
    """
    __tablename__ = "wo_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ot_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="Tipo de OT al que aplica (work_order_types.code)"
    )
    code: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Código interno (ej: realizada, no_realizada, reconfig)"
    )
    name: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="Nombre visible (ej: Realizada, No Realizada, Reconfiguración)"
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Descripción de cuándo se usa esta acción"
    )
    requires_notes: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="Si requiere descripción obligatoria"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Orden de aparición en el wizard"
    )
    is_builtin: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="Si es un acción fija del sistema (no se puede eliminar)"
    )

    __table_args__ = (
        UniqueConstraint("ot_type", "code", name="uq_wo_action_ot_type_code"),
    )

    def __repr__(self) -> str:
        return f"<WOAction(id={self.id}, ot={self.ot_type}, code='{self.code}')>"
