"""add_action_code_to_wo_templates

Revision ID: 2026_06_07_004
Revises: 2026_06_07_003
"""

from alembic import op
import sqlalchemy as sa

revision = '2026_06_07_004'
down_revision = '2026_06_07_003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('wo_templates',
        sa.Column('action_code', sa.String(50), nullable=True, index=True,
                  comment="Acción de resolución a la que aplica"))


def downgrade():
    op.drop_column('wo_templates', 'action_code')
