"""Add coordination models (teams, team_members)

Revision ID: 2026_02_02_001_coordination
Revises: m1n2o3p4q5r6
Create Date: 2026-02-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2026_02_02_001_coordination'
down_revision = 'm1n2o3p4q5r6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crear enum para roles (con IF NOT EXISTS)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE team_role_enum AS ENUM ('leader', 'technician');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # Crear tabla teams
    op.create_table(
        'teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_teams_name'),
    )
    op.create_index('ix_teams_id', 'teams', ['id'], unique=True)
    op.create_index('ix_teams_name', 'teams', ['name'], unique=True)
    op.create_index('ix_teams_is_active', 'teams', ['is_active'])
    op.create_index('ix_teams_vehicle_id', 'teams', ['vehicle_id'])

    # Crear tabla team_members
    op.create_table(
        'team_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], name='fk_team_members_team_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_team_members_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'user_id', name='uq_team_members_team_user'),
    )
    op.create_index('ix_team_members_id', 'team_members', ['id'], unique=True)
    op.create_index('ix_team_members_team_id', 'team_members', ['team_id'])
    op.create_index('ix_team_members_user_id', 'team_members', ['user_id'])
    
    # Convertir role a ENUM después
    op.execute('ALTER TABLE team_members ALTER COLUMN role TYPE team_role_enum USING role::team_role_enum')
    # Establecer default después
    op.execute("ALTER TABLE team_members ALTER COLUMN role SET DEFAULT 'technician'::team_role_enum")


def downgrade() -> None:
    # Eliminar tabla team_members
    op.drop_table('team_members')
    
    # Eliminar tabla teams
    op.drop_table('teams')
    
    # Eliminar enum
    team_role_enum = postgresql.ENUM('leader', 'technician', name='team_role_enum')
    team_role_enum.drop(op.get_bind())
