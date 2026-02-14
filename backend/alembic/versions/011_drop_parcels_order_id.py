"""Drop parcels.order_id — parcel-order link only via ParcelItem/OrderItem.

Revision ID: 011
Revises: 010
Create Date: 2026-02-14

"""
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_parcels_order_id", table_name="parcels")
    op.drop_constraint("fk_parcels_order_id", "parcels", type_="foreignkey")
    op.drop_column("parcels", "order_id")


def downgrade() -> None:
    from sqlalchemy.dialects.postgresql import UUID
    import sqlalchemy as sa

    op.add_column("parcels", sa.Column("order_id", UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        "fk_parcels_order_id",
        "parcels",
        "orders",
        ["order_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_parcels_order_id", "parcels", ["order_id"], unique=False)
