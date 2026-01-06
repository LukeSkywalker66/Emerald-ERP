"""fix_timeline_event_type_uppercase

Revision ID: e4c5f2d1a8b9
Revises: fabcca987f2b
Create Date: 2026-01-05 11:58:31.170424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e4c5f2d1a8b9'
down_revision: Union[str, Sequence[str], None] = 'fabcca987f2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - fix uppercase event type values in ticket_timeline."""
    # Convertir valores en mayúscula a minúsculas en la tabla ticket_timeline
    op.execute("""
        UPDATE ticket_timeline SET event_type = 'note' WHERE event_type = 'NOTE';
        UPDATE ticket_timeline SET event_type = 'alert' WHERE event_type = 'ALERT';
        UPDATE ticket_timeline SET event_type = 'ot_event' WHERE event_type = 'OT_EVENT';
        UPDATE ticket_timeline SET event_type = 'status_change' WHERE event_type = 'STATUS_CHANGE';
    """)


def downgrade() -> None:
    """Downgrade schema."""
    pass
