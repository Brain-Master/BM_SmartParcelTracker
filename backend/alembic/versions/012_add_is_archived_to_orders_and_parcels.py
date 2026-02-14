"""Add is_archived to orders and parcels (Sprint 2.2.3).

Revision ID: 012
Revises: 011
Create Date: 2026-02-15

"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "parcels",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("parcels", "is_archived")
    op.drop_column("orders", "is_archived")
