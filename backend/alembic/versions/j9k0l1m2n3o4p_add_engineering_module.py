"""Add engineering module

Revision ID: j9k0l1m2n3o4p
Revises: 975f880c8062
Create Date: 2026-01-16 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'j9k0l1m2n3o4p'
down_revision = '975f880c8062'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Upgrade para módulo Engineering/NOC.
    
    Cambios:
    1. Agregar valores a ticket_status_enum: waiting_internal, attention_required
    2. Crear enums para tareas: task_type, priority, status (si no existen)
    3. Crear tabla engineering_tasks
    4. Crear índices compuestos para performance
    """
    
    # ===========================
    # PASO 1: Extender ticket_status_enum (ignorar si ya existe)
    # ===========================
    # Verificar si los valores ya existen antes de agregarlos
    conn = op.get_bind()
    
    # Check waiting_internal
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'waiting_internal' "
        "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ticket_status_enum'))"
    ))
    if not result.scalar():
        op.execute("ALTER TYPE ticket_status_enum ADD VALUE 'waiting_internal'")
    
    # Check attention_required
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'attention_required' "
        "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ticket_status_enum'))"
    ))
    if not result.scalar():
        op.execute("ALTER TYPE ticket_status_enum ADD VALUE 'attention_required'")

    # ===========================
    # PASO 2: Crear ENUMs para tareas (si no existen)
    # ===========================
    # Check if enums exist first
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engineering_task_type_enum')"
    ))
    if not result.scalar():
        engineering_task_type_enum = postgresql.ENUM(
            'incident', 'maintenance', 'project',
            name='engineering_task_type_enum'
        )
        engineering_task_type_enum.create(op.get_bind())

    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engineering_task_priority_enum')"
    ))
    if not result.scalar():
        engineering_task_priority_enum = postgresql.ENUM(
            'low', 'medium', 'high', 'critical',
            name='engineering_task_priority_enum'
        )
        engineering_task_priority_enum.create(op.get_bind())

    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engineering_task_status_enum')"
    ))
    if not result.scalar():
        engineering_task_status_enum = postgresql.ENUM(
            'backlog', 'in_progress', 'testing', 'completed', 'rejected',
            name='engineering_task_status_enum'
        )
        engineering_task_status_enum.create(op.get_bind())

    # ===========================
    # PASO 3: Crear tabla engineering_tasks (si no existe)
    # ===========================
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_name = 'engineering_tasks')"
    ))
    if not result.scalar():
        op.create_table(
            'engineering_tasks',
            sa.Column(
                'id',
                sa.Integer(),
                nullable=False,
                comment='ID único de la tarea'
            ),
            sa.Column(
                'ticket_id',
                sa.Integer(),
                nullable=True,
                comment='FK a ticket de soporte (NULL para tareas proactivas)'
            ),
            sa.Column(
                'title',
                sa.String(length=255),
                nullable=False,
                comment='Título/descripción breve de la tarea'
            ),
            sa.Column(
                'description',
                sa.Text(),
                nullable=True,
                comment='Descripción detallada de qué hacer'
            ),
            sa.Column(
                'task_type',
                postgresql.ENUM('incident', 'maintenance', 'project', name='engineering_task_type_enum', create_type=False),
                nullable=False,
                comment='Tipo: incident, maintenance, project'
            ),
            sa.Column(
                'priority',
                postgresql.ENUM('low', 'medium', 'high', 'critical', name='engineering_task_priority_enum', create_type=False),
                nullable=False,
                comment='Prioridad: critical, high, medium, low'
            ),
            sa.Column(
                'status',
                postgresql.ENUM('backlog', 'in_progress', 'testing', 'completed', 'rejected', name='engineering_task_status_enum', create_type=False),
                nullable=False,
                comment='Estado: backlog, in_progress, testing, completed, rejected'
            ),
            sa.Column(
                'assigned_to_id',
                sa.Integer(),
                nullable=True,
                comment='Ingeniero asignado a la tarea'
            ),
            sa.Column(
                'created_by_id',
                sa.Integer(),
                nullable=False,
                comment='Usuario que creó la tarea'
            ),
            sa.Column(
                'scheduled_date',
                sa.DateTime(timezone=True),
                nullable=True,
                comment='Fecha estimada de inicio (para planificación)'
            ),
            sa.Column(
                'started_at',
                sa.DateTime(timezone=True),
                nullable=True,
                comment='Timestamp de inicio (cuando pasó a in_progress)'
            ),
            sa.Column(
                'completed_at',
                sa.DateTime(timezone=True),
                nullable=True,
                comment='Timestamp de completación (cuando pasó a completed o rejected)'
            ),
            sa.Column(
                'resolution_note',
                sa.Text(),
                nullable=True,
                comment='Nota de resolución cuando status=completed'
            ),
            sa.Column(
                'rejection_reason',
                sa.Text(),
                nullable=True,
                comment='Razón de rechazo cuando status=rejected'
            ),
            sa.Column(
                'timeline_data',
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
                comment='Histórico de cambios de estado en formato JSON'
            ),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
                comment='Timestamp de creación'
            ),
            sa.Column(
                'updated_at',
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                onupdate=sa.func.now(),
                nullable=False,
                comment='Timestamp de última actualización'
            ),
            sa.ForeignKeyConstraint(
                ['ticket_id'],
                ['tickets.id'],
                name='fk_engineering_tasks_ticket_id',
                ondelete='CASCADE'
            ),
            sa.ForeignKeyConstraint(
                ['assigned_to_id'],
                ['users.id'],
                name='fk_engineering_tasks_assigned_to_id',
                ondelete='SET NULL'
            ),
            sa.ForeignKeyConstraint(
                ['created_by_id'],
                ['users.id'],
                name='fk_engineering_tasks_created_by_id',
                ondelete='RESTRICT'
            ),
            sa.PrimaryKeyConstraint('id'),
            comment='Tareas de ingeniería derivadas de tickets o internas'
        )

        # ===========================
        # PASO 4: Crear índices
        # ===========================
        
        # Índice en PK
        op.create_index('ix_engineering_tasks_id', 'engineering_tasks', ['id'])

        # Índice en FKs
        op.create_index('ix_engineering_tasks_ticket_id', 'engineering_tasks', ['ticket_id'])
        op.create_index('ix_engineering_tasks_assigned_to_id', 'engineering_tasks', ['assigned_to_id'])
        op.create_index('ix_engineering_tasks_created_by_id', 'engineering_tasks', ['created_by_id'])

        # Índices en columnas de búsqueda frecuente
        op.create_index('ix_engineering_tasks_task_type', 'engineering_tasks', ['task_type'])
        op.create_index('ix_engineering_tasks_priority', 'engineering_tasks', ['priority'])
        op.create_index('ix_engineering_tasks_status', 'engineering_tasks', ['status'])

        # Índices compuestos para queries de dashboard/filtrado
        op.create_index(
            'idx_engineering_tasks_ticket_status',
            'engineering_tasks',
            ['ticket_id', 'status']
        )
        op.create_index(
            'idx_engineering_tasks_assigned_status',
            'engineering_tasks',
            ['assigned_to_id', 'status']
        )
        op.create_index(
            'idx_engineering_tasks_type_priority_status',
            'engineering_tasks',
            ['task_type', 'priority', 'status']
        )


def downgrade() -> None:
    """
    Downgrade para módulo Engineering/NOC.
    
    Revierte:
    1. Elimina tabla engineering_tasks (cascade)
    2. Elimina ENUMs
    3. Elimina valores de ticket_status_enum (no se puede, dejar como está)
    """
    
    # Eliminar tabla (con indices automáticamente)
    op.drop_table('engineering_tasks')

    # Eliminar ENUMs
    sa.Enum(name='engineering_task_type_enum').drop(op.get_bind())
    sa.Enum(name='engineering_task_priority_enum').drop(op.get_bind())
    sa.Enum(name='engineering_task_status_enum').drop(op.get_bind())

    # Nota: No se pueden eliminar valores de ENUM en PostgreSQL
    # waiting_internal y attention_required permanecerán en ticket_status_enum
