"""Add parcel_items junction table for split shipments.

Revision ID: 004
Revises: 003
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "parcel_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("parcel_id", UUID(as_uuid=False), nullable=False),
        sa.Column("order_item_id", UUID(as_uuid=False), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_item_id"], ["order_items.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("parcel_id", "order_item_id", name="uq_parcel_item"),
        sa.CheckConstraint("quantity > 0", name="ck_parcel_item_quantity_positive"),
    )
    op.create_index("ix_parcel_items_parcel_id", "parcel_items", ["parcel_id"])
    op.create_index("ix_parcel_items_order_item_id", "parcel_items", ["order_item_id"])


def downgrade() -> None:
    op.drop_index("ix_parcel_items_order_item_id", table_name="parcel_items")
    op.drop_index("ix_parcel_items_parcel_id", table_name="parcel_items")
    op.drop_table("parcel_items")
