"""normalize work_order_types codes to the WorkOrderType enum

Revision ID: 2026_10_12_007
Revises: 2026_10_12_006
Create Date: 2026-10-12 00:00:00.000000

La tabla work_order_types es editable (Settings > Tipos de OT). Pueden quedar
códigos legacy (ej. 'install') que ya no existen en el enum WorkOrderType
(install_ftth / install_aire / repair / pickup / infrastructure). Esos códigos
rompen el POST /work-orders con 422 al seleccionar "Instalación".

Esta migración:
- mapea 'install' → 'install_ftth'.
- desactiva cualquier otro código fuera del enum para que no aparezca en el combo.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '2026_10_12_007'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Desactiva códigos legacy (ej. 'install') o custom que ya no existen en el enum.
    # No se renombran a install_ftth/install_aire para no colisionar con el UNIQUE de
    # code ni duplicar los tipos base que ya sembró 2026_06_07_001.
    op.execute(
        """
        UPDATE work_order_types
        SET is_active = false
        WHERE code NOT IN ('install', 'install_ftth', 'install_aire', 'repair', 'pickup', 'infrastructure')
        """
    )


def downgrade() -> None:
    # No es destructiva: la operación inversa de normalizar códigos no tiene
    # sentido seguro (no se restaura un código legacy).
    pass
