"""Add price_per_item to order_items and order_id to parcels.

Revision ID: 003
Revises: 002
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, NUMERIC

# revision identifiers
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add price_per_item to order_items
    op.add_column(
        "order_items",
        sa.Column("price_per_item", NUMERIC(14, 2), nullable=True),
    )
    # Add order_id to parcels (optional FK to orders)
    op.add_column(
        "parcels",
        sa.Column("order_id", UUID(as_uuid=False), nullable=True),
    )
    op.create_foreign_key(
        "fk_parcels_order_id",
        "parcels",
        "orders",
        ["order_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_parcels_order_id", "parcels", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_parcels_order_id", table_name="parcels")
    op.drop_constraint("fk_parcels_order_id", "parcels", type_="foreignkey")
    op.drop_column("parcels", "order_id")
    op.drop_column("order_items", "price_per_item")
