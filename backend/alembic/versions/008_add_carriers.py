"""Add carriers (delivery services) table — variant A: delete forbidden when parcels use carrier.

Revision ID: 008
Revises: 007
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "carriers",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_carriers_slug", "carriers", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_carriers_slug", table_name="carriers")
    op.drop_table("carriers")
