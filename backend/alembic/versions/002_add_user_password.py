"""Add hashed_password to users

Revision ID: 002_add_user_password
Revises: 001_initial_schema
Create Date: 2026-02-14 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_user_password'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add hashed_password column to users table
    op.add_column('users', sa.Column('hashed_password', sa.String(length=255), nullable=False, server_default=''))
    # Remove server_default after adding (it was only for existing rows)
    op.alter_column('users', 'hashed_password', server_default=None)


def downgrade() -> None:
    op.drop_column('users', 'hashed_password')
