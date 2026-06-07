"""add_installation_signal_dbm_to_connections

Agrega columna installation_signal_dbm a la tabla connections
para registrar el nivel de señal óptica/RSSI al momento de la instalación.

Revision ID: 2026_06_07_007
Revises: 2026_06_07_006
"""

from alembic import op
import sqlalchemy as sa

revision = '2026_06_07_007'
down_revision = '2026_06_07_006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('connections', sa.Column(
        'installation_signal_dbm',
        sa.Numeric(6, 2),
        nullable=True,
        comment="Nivel de señal óptica/RSSI al momento de la instalación (dBm)"
    ))


def downgrade():
    op.drop_column('connections', 'installation_signal_dbm')
