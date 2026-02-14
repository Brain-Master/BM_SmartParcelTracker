"""Extend OrderItemStatus enum with new values (plan §6).

Revision ID: 009
Revises: 008
Create Date: 2026-02-14

"""
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None

NEW_VALUES = [
    "Waiting_Payment",
    "Payment_Verification",
    "Seller_Packing",
    "Partially_Shipped",
    "Partially_Received",
    "Cancelled",
]


def upgrade() -> None:
    for value in NEW_VALUES:
        op.execute(f"ALTER TYPE orderitemstatus ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
