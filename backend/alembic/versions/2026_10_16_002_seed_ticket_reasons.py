"""seed canónico de ticket_reasons (motivos/subtipos de ticket)

Revision ID: 2026_10_16_002
Revises: 2026_10_16_001
Create Date: 2026-10-16 00:00:00.000000

Contexto: la tabla `ticket_reasons` se creó en `add_ticket_reasons` pero NUNCA se
sembró desde una migración. Los motivos (p. ej. "Cambio de clave WiFi",
"Cableado de dispositivos", "Auditar instalación" en Servicio Técnico) se
cargaron manualmente en desarrollo, por lo que no viajaron a producción.

Esta migración es idempotente: inserta los motivos canónicos que falten,
relacionándolos con su categoría por `flow_key` (estable entre entornos) y
evitando duplicados por (name, category_id).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_16_002'
down_revision: Union[str, Sequence[str], None] = '2026_10_16_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (name, flow_key de la categoría padre)
_REASONS = [
    ("Sin Servicio", "technical"),
    ("Intermitencia/Microcortes", "technical"),
    ("Lentitud", "technical"),
    ("Problema WiFi", "technical"),
    ("Cambio de clave WiFi", "technical"),
    ("Cableado de dispositivos", "technical"),
    ("Auditar instalación", "technical"),
    ("Cambio de Plan/Servicio", "administrative"),
    ("Cambio de Titularidad", "administrative"),
    ("Facturación", "administrative"),
    ("Traslado Interno", "relocation"),
    ("Traslado a otro domicilio", "relocation"),
    ("Precio/Competencia", "withdrawal"),
    ("Disconformidad Técnica", "withdrawal"),
    ("Mudanza", "withdrawal"),
    ("Fallecimiento", "withdrawal"),
]


def _values_sql() -> str:
    """Serializa la lista de motivos como VALUES (name, flow_key)."""
    rows = ", ".join(
        f"('{name.replace(chr(39), chr(39) + chr(39))}', '{flow_key}')"
        for name, flow_key in _REASONS
    )
    return rows


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO ticket_reasons (name, category_id)
        SELECT v.name, c.id
        FROM (VALUES {_values_sql()}) AS v(name, flow_key)
        JOIN ticket_categories c ON c.flow_key = v.flow_key
        WHERE NOT EXISTS (
            SELECT 1 FROM ticket_reasons r
            WHERE r.name = v.name AND r.category_id = c.id
        )
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        DELETE FROM ticket_reasons r
        USING ticket_categories c,
              (VALUES {_values_sql()}) AS v(name, flow_key)
        WHERE r.category_id = c.id
          AND c.flow_key = v.flow_key
          AND r.name = v.name
        """
    )
