"""Add deleted_at to orders (soft delete / variant C).

Revision ID: 006
Revises: 005
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_orders_deleted_at", "orders", ["deleted_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_orders_deleted_at", table_name="orders")
    op.drop_column("orders", "deleted_at")
