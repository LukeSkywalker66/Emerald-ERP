"""add pending_closure status to work_orders (Prisión del Técnico)

Revision ID: 2026_03_04_001
Revises: 2026_03_03_002
Create Date: 2026-03-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2026_03_04_001'
down_revision = ('2026_03_03_002', 'e531d3d1fe20')  # Merge de ambos branches
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Agregar estado 'pending_closure' al enum WorkOrderStatus.
    
    ⚠️ PRISIÓN DEL TÉCNICO:
    Este estado representa OTs vencidas sin cerrar que bloquean la agenda del técnico.
    
    - OTs con scheduled_end pasada + 30min grace que no se completaron
    - Mantiene team_id y scheduled_start (para trazabilidad)
    - Técnico debe completarla (con fotos/materiales) para desbloquear agenda
    - Celery job detecta y marca automáticamente cada 30 min
    
    PostgreSQL requiere que ALTER TYPE ADD VALUE se ejecute fuera de transacción.
    """
    # Obtener conexión y ejecutar ALTER TYPE fuera de transacción
    connection = op.get_bind()
    
    # Verificar si el valor ya existe
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'work_order_status_enum'
            AND e.enumlabel = 'pending_closure'
        );
    """))
    
    value_exists = result.scalar()
    
    if not value_exists:
        # Ejecutar fuera de transacción usando COMMIT; ALTER TYPE; BEGIN;
        connection.execute(sa.text("COMMIT"))
        connection.execute(sa.text(
            "ALTER TYPE work_order_status_enum ADD VALUE 'pending_closure'"
        ))
        connection.execute(sa.text("BEGIN"))
    
    # Ahora crear índices (ya dentro de transacción normal)
    op.create_index(
        'ix_work_orders_pending_closure',
        'work_orders',
        ['status', 'team_id', 'scheduled_end'],
        unique=False,
        postgresql_where=sa.text("status = 'pending_closure'")
    )
    
    # Agregar índice compuesto para el endpoint del técnico
    op.create_index(
        'ix_work_orders_pending_closure_by_tech',
        'work_orders',
        ['status', 'technician_id'],
        unique=False,
        postgresql_where=sa.text("status = 'pending_closure'")
    )


def downgrade() -> None:
    """
    Remover índices creados.
    
    NOTA: PostgreSQL no permite eliminar valores de ENUM sin recrear el tipo completo,
    por lo que no revertimos el cambio al enum. En caso de rollback crítico,
    se requiere migración manual.
    """
    op.drop_index('ix_work_orders_pending_closure_by_tech', 'work_orders')
    op.drop_index('ix_work_orders_pending_closure', 'work_orders')
    
    # WARNING: No se puede eliminar el valor del enum sin recrear el tipo.
    # Si hay WOs en 'pending_closure', primero deben moverse a otro estado.
    print("⚠️ ADVERTENCIA: El valor 'pending_closure' permanece en el enum.")
    print("   Para eliminarlo completamente, se requiere migración manual que:")
    print("   1. Mueva todas las WOs en 'pending_closure' a otro estado")
    print("   2. Recree el tipo enum sin ese valor")
