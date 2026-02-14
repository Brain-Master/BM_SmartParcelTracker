"""Add stores (platforms) table — variant A: delete forbidden when orders use platform.

Revision ID: 007
Revises: 006
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stores",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_stores_slug", "stores", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_stores_slug", table_name="stores")
    op.drop_table("stores")
