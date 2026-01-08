"""Rename tickets_v2 table to tickets and park legacy tickets.

Revision ID: e2b1d0c4f8a1
Revises: c4d5e6f7a8b9
Create Date: 2026-01-08 18:30:00.000000

- Renombra la tabla principal de tickets de `tickets_v2` a `tickets`
- Mueve la tabla legacy `tickets` a `tickets_legacy` si existe
- Ajusta nombres de índices para eliminar el sufijo _v2 y evitar colisiones futuras
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "e2b1d0c4f8a1"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Preservar tabla legacy "tickets" si existe, renombrándola a tickets_legacy
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'tickets'
            ) THEN
                -- Evitar conflicto de nombres de índice con la nueva tabla
                IF EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = 'ix_tickets_id'
                ) THEN
                    EXECUTE 'ALTER INDEX ix_tickets_id RENAME TO ix_tickets_legacy_id';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'tickets_legacy'
                ) THEN
                    EXECUTE 'ALTER TABLE tickets RENAME TO tickets_legacy';
                ELSE
                    RAISE NOTICE 'Tabla tickets_legacy ya existe; se omite el rename de tickets.';
                END IF;
            END IF;
        END $$;
        """
    )

    # 2) Renombrar tabla principal a tickets
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'tickets_v2'
            ) THEN
                EXECUTE 'ALTER TABLE tickets_v2 RENAME TO tickets';
            END IF;
        END $$;
        """
    )

    # 3) Renombrar índices generados automáticamente para eliminar sufijo _v2
    op.execute("ALTER INDEX IF EXISTS ix_tickets_v2_assigned_to_id RENAME TO ix_tickets_assigned_to_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_v2_connection_id RENAME TO ix_tickets_connection_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_v2_creator_id RENAME TO ix_tickets_creator_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_v2_id RENAME TO ix_tickets_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_v2_priority RENAME TO ix_tickets_priority;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_v2_status RENAME TO ix_tickets_status;")


def downgrade() -> None:
    # 1) Revertir nombres de índices al formato anterior con sufijo _v2
    op.execute("ALTER INDEX IF EXISTS ix_tickets_assigned_to_id RENAME TO ix_tickets_v2_assigned_to_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_connection_id RENAME TO ix_tickets_v2_connection_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_creator_id RENAME TO ix_tickets_v2_creator_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_id RENAME TO ix_tickets_v2_id;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_priority RENAME TO ix_tickets_v2_priority;")
    op.execute("ALTER INDEX IF EXISTS ix_tickets_status RENAME TO ix_tickets_v2_status;")

    # 2) Renombrar tabla principal de vuelta a tickets_v2
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'tickets'
            ) THEN
                EXECUTE 'ALTER TABLE tickets RENAME TO tickets_v2';
            END IF;
        END $$;
        """
    )

    # 3) Restaurar la tabla legacy a su nombre original si estaba presente
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'tickets_legacy'
            ) THEN
                IF EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = 'ix_tickets_legacy_id'
                ) THEN
                    EXECUTE 'ALTER INDEX ix_tickets_legacy_id RENAME TO ix_tickets_id';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'tickets'
                ) THEN
                    EXECUTE 'ALTER TABLE tickets_legacy RENAME TO tickets';
                ELSE
                    RAISE NOTICE 'Tabla tickets ya existe; no se renombra tickets_legacy.';
                END IF;
            END IF;
        END $$;
        """
    )
