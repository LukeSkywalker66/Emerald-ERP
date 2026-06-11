"""add serial_formats and purchase_scan_sessions tables

Revision ID: 2026_06_09_001
Revises: 2026_06_08_004
Create Date: 2026-06-09 00:00:00.000000

"""
from __future__ import annotations
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "2026_06_09_001"
down_revision: Union[str, None] = "2026_06_08_004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade: crear tablas serial_formats y purchase_scan_sessions."""

    # ---------------------------------------------------------------
    # Tabla: serial_formats
    # Diccionario de patrones de número de serie por producto.
    # ---------------------------------------------------------------
    op.create_table(
        "serial_formats",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            comment="Producto asociado al patrón",
        ),
        sa.Column(
            "regex_pattern",
            sa.String(255),
            nullable=False,
            comment="Patrón regex que debe cumplir el SN",
        ),
        sa.Column(
            "description",
            sa.String(200),
            nullable=True,
            comment="Descripción legible del patrón",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="Si el patrón está activo para validación",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", name="uq_serial_format_product"),
    )

    # ---------------------------------------------------------------
    # Tabla: purchase_scan_sessions
    # Sesiones de escaneo activas para compras/ingresos de stock.
    # ---------------------------------------------------------------
    op.create_table(
        "purchase_scan_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "warehouse_id",
            sa.Integer(),
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
            comment="Almacén destino de los seriales",
        ),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
            comment="Producto serializado que se está escaneando",
        ),
        sa.Column(
            "scanned_sns",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
            comment="Array de strings con SNs escaneados (para dedup)",
        ),
        sa.Column(
            "count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="Contador de seriales ingresados",
        ),
        sa.Column(
            "is_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="True cuando el operador confirma la carga",
        ),
        sa.Column(
            "reference",
            sa.String(200),
            nullable=True,
            comment="Referencia de la compra (factura, orden, remito)",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
            comment="Notas adicionales de la compra",
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            comment="Usuario que realiza la compra",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Nota: los índices en FK columns los crea SQLAlchemy automáticamente
    # via index=True en la definición de columna.

    # ---------------------------------------------------------------
    # Seed data: patrón ITU-T G.984 para productos ONU/ONT
    # ---------------------------------------------------------------
    op.execute(
        """
        INSERT INTO serial_formats (product_id, regex_pattern, description, is_active)
        SELECT
            p.id,
            '^[A-Z0-9]{4}[A-Z0-9]{8}$',
            'ITU-T G.984 ONT - 4 chars vendor + 8 chars serial',
            true
        FROM products p
        JOIN product_groups g ON p.group_id = g.id
        WHERE
            (g.name ILIKE '%ONU%' OR g.name ILIKE '%ONT%')
            AND p.type = 'SERIALIZED'
            AND NOT EXISTS (
                SELECT 1 FROM serial_formats sf WHERE sf.product_id = p.id
            )
        """
    )


def downgrade() -> None:
    """Downgrade: eliminar tablas y datos asociados."""
    op.drop_table("purchase_scan_sessions")
    op.drop_table("serial_formats")
