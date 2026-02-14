"""Add price_per_item to order_items and order_id to parcels.

Revision ID: 003
Revises: 002_add_user_password
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, NUMERIC

# revision identifiers
revision = "003"
down_revision = "002_add_user_password"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    )
    return r.scalar() is not None


def _constraint_exists(conn, name: str) -> bool:
    r = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_constraint WHERE conname = :n"
        ),
        {"n": name},
    )
    return r.scalar() is not None


def _index_exists(conn, name: str) -> bool:
    r = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :n"),
        {"n": name},
    )
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    # Add price_per_item to order_items (idempotent)
    if not _column_exists(conn, "order_items", "price_per_item"):
        op.add_column(
            "order_items",
            sa.Column("price_per_item", NUMERIC(14, 2), nullable=True),
        )
    # Add order_id to parcels (idempotent)
    if not _column_exists(conn, "parcels", "order_id"):
        op.add_column(
            "parcels",
            sa.Column("order_id", UUID(as_uuid=False), nullable=True),
        )
    if not _constraint_exists(conn, "fk_parcels_order_id"):
        op.create_foreign_key(
            "fk_parcels_order_id",
            "parcels",
            "orders",
            ["order_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if not _index_exists(conn, "ix_parcels_order_id"):
        op.create_index("ix_parcels_order_id", "parcels", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_parcels_order_id", table_name="parcels")
    op.drop_constraint("fk_parcels_order_id", "parcels", type_="foreignkey")
    op.drop_column("parcels", "order_id")
    op.drop_column("order_items", "price_per_item")
