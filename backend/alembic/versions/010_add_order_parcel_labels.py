"""Add label to orders and parcels (human-readable name).

Revision ID: 010
Revises: 009
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("label", sa.String(128), nullable=True))
    op.add_column("parcels", sa.Column("label", sa.String(128), nullable=True))


def downgrade() -> None:
    op.drop_column("parcels", "label")
    op.drop_column("orders", "label")
