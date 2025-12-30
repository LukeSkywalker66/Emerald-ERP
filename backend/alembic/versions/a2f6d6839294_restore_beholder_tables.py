"""restore_beholder_tables

Revision ID: a2f6d6839294
Revises: 9644b7a12e21
Create Date: 2025-12-30 16:31:58.218663

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a2f6d6839294'
down_revision: Union[str, Sequence[str], None] = '9644b7a12e21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restore Beholder tables."""
    # Subscribers
    op.create_table(
        "subscribers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("unique_external_id", sa.String(), nullable=True),
        sa.Column("sn", sa.String(), nullable=True),
        sa.Column("olt_name", sa.String(), nullable=True),
        sa.Column("olt_id", sa.String(), nullable=True),
        sa.Column("board", sa.String(), nullable=True),
        sa.Column("port", sa.String(), nullable=True),
        sa.Column("onu", sa.String(), nullable=True),
        sa.Column("onu_type_id", sa.String(), nullable=True),
        sa.Column("mode", sa.String(), nullable=True),
        sa.Column("node_id", sa.Integer(), nullable=True),
        sa.Column("connection_id", sa.Integer(), nullable=True),
        sa.Column("vlan", sa.String(), nullable=True),
        sa.Column("pppoe_username", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subscribers_id"), "subscribers", ["id"], unique=False)
    op.create_index(op.f("ix_subscribers_unique_external_id"), "subscribers", ["unique_external_id"], unique=False)
    op.create_index(op.f("ix_subscribers_node_id"), "subscribers", ["node_id"], unique=False)
    op.create_index(op.f("ix_subscribers_connection_id"), "subscribers", ["connection_id"], unique=False)
    op.create_index(op.f("ix_subscribers_pppoe_username"), "subscribers", ["pppoe_username"], unique=False)

    # Nodes
    op.create_table(
        "nodes",
        sa.Column("node_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("puerto", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("node_id"),
    )

    # Connections
    op.create_table(
        "connections",
        sa.Column("connection_id", sa.Integer(), nullable=False),
        sa.Column("pppoe_username", sa.String(), nullable=True),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("node_id", sa.Integer(), nullable=True),
        sa.Column("plan_id", sa.Integer(), nullable=True),
        sa.Column("direccion", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("connection_id"),
    )
    op.create_index(op.f("ix_connections_pppoe_username"), "connections", ["pppoe_username"], unique=False)
    op.create_index(op.f("ix_connections_customer_id"), "connections", ["customer_id"], unique=False)

    # Clientes
    op.create_table(
        "clientes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("doc_number", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("tax_residence", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_clientes_name"), "clientes", ["name"], unique=False)

    # Clientes emails
    op.create_table(
        "clientes_emails",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Clientes telefonos
    op.create_table(
        "clientes_telefonos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("number", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # PPP Secrets
    op.create_table(
        "ppp_secrets",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("router_ip", sa.String(), nullable=False),
        sa.Column("password", sa.String(), nullable=True),
        sa.Column("profile", sa.String(), nullable=True),
        sa.Column("service", sa.String(), nullable=True),
        sa.Column("last_caller_id", sa.String(), nullable=True),
        sa.Column("comment", sa.String(), nullable=True),
        sa.Column("last_logged_out", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("name", "router_ip"),
    )
    op.create_index(op.f("ix_ppp_secrets_last_caller_id"), "ppp_secrets", ["last_caller_id"], unique=False)

    # Sync status
    op.create_table(
        "sync_status",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fuente", sa.String(), nullable=True),
        sa.Column("ultima_actualizacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("estado", sa.String(), nullable=True),
        sa.Column("detalle", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Drop Beholder tables."""
    op.drop_table("sync_status")
    op.drop_table("ppp_secrets")
    op.drop_table("clientes_telefonos")
    op.drop_table("clientes_emails")
    op.drop_table("clientes")
    op.drop_table("connections")
    op.drop_table("nodes")
    op.drop_table("subscribers")
