"""Add shipping_cost and customs_cost to orders.

Revision ID: 005
Revises: 004
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import NUMERIC

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("shipping_cost", NUMERIC(10, 2), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("customs_cost", NUMERIC(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "customs_cost")
    op.drop_column("orders", "shipping_cost")
