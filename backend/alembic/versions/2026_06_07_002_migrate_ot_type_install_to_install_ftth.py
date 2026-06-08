"""migrate_ot_type_install_to_install_ftth

Revision ID: 2026_06_07_002
Revises: 2026_06_07_001
Create Date: 2026-06-07 11:00:00.000000

Actualiza registros existentes con ot_type='install' a 'install_ftth'
ya que el enum WorkOrderType cambió: 'install' → 'install_ftth' e 'install_aire'.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_07_002'
down_revision: Union[str, Sequence[str], None] = '2026_06_07_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Migrar work_orders: 'install' → 'install_ftth'
    result = conn.execute(
        sa.text("UPDATE work_orders SET ot_type = 'install_ftth' WHERE ot_type = 'install'")
    )
    print(f"  ✅ Migradas {result.rowcount} OT(s) de 'install' a 'install_ftth'")

    # Migrar engineering_tasks si usa el mismo enum
    try:
        result = conn.execute(
            sa.text("UPDATE engineering_tasks SET task_type = 'install_ftth' WHERE task_type = 'install'")
        )
        if result.rowcount > 0:
            print(f"  ✅ Migradas {result.rowcount} engineering_task(s) de 'install' a 'install_ftth'")
    except Exception:
        pass  # La tabla puede no tener esta columna


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE work_orders SET ot_type = 'install' WHERE ot_type = 'install_ftth'")
    )
    try:
        conn.execute(
            sa.text("UPDATE engineering_tasks SET task_type = 'install' WHERE task_type = 'install_ftth'")
        )
    except Exception:
        pass
