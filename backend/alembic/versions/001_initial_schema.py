"""Initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-02-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types explicitly (checkfirst=True for idempotent reset/rerun).
    # create_type=False so create_table() does not try to create them again.
    bind = op.get_bind()
    maincurrency = postgresql.ENUM('RUB', 'USD', 'EUR', name='maincurrency', create_type=False)
    maincurrency.create(bind, checkfirst=True)
    
    parcelstatus = postgresql.ENUM(
        'Created', 'In_Transit', 'PickUp_Ready', 'Delivered', 'Lost', 'Archived',
        name='parcelstatus', create_type=False
    )
    parcelstatus.create(bind, checkfirst=True)
    
    orderitemstatus = postgresql.ENUM(
        'Waiting_Shipment', 'Shipped', 'Received', 'Dispute_Open', 'Refunded',
        name='orderitemstatus', create_type=False
    )
    orderitemstatus.create(bind, checkfirst=True)
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('main_currency', maincurrency, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    
    # Create orders table
    op.create_table(
        'orders',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('platform', sa.String(length=64), nullable=False),
        sa.Column('order_number_external', sa.String(length=128), nullable=False),
        sa.Column('order_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('protection_end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('price_original', postgresql.NUMERIC(precision=14, scale=2), nullable=False),
        sa.Column('currency_original', sa.String(length=3), nullable=False),
        sa.Column('exchange_rate_frozen', postgresql.NUMERIC(precision=12, scale=6), nullable=False),
        sa.Column('price_final_base', postgresql.NUMERIC(precision=14, scale=2), nullable=False),
        sa.Column('is_price_estimated', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_orders_order_number_external'), 'orders', ['order_number_external'], unique=False)
    op.create_index(op.f('ix_orders_protection_end_date'), 'orders', ['protection_end_date'], unique=False)
    op.create_index(op.f('ix_orders_user_id'), 'orders', ['user_id'], unique=False)
    
    # Create parcels table
    op.create_table(
        'parcels',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('tracking_number', sa.String(length=128), nullable=False),
        sa.Column('carrier_slug', sa.String(length=64), nullable=False),
        sa.Column('status', parcelstatus, nullable=False),
        sa.Column('tracking_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('weight_kg', postgresql.NUMERIC(precision=8, scale=3), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_parcels_status'), 'parcels', ['status'], unique=False)
    op.create_index(op.f('ix_parcels_tracking_number'), 'parcels', ['tracking_number'], unique=False)
    op.create_index(op.f('ix_parcels_user_id'), 'parcels', ['user_id'], unique=False)
    
    # Create order_items table
    op.create_table(
        'order_items',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('parcel_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('item_name', sa.String(length=512), nullable=False),
        sa.Column('image_url', sa.String(length=1024), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.Text()), nullable=False, server_default='{}'),
        sa.Column('quantity_ordered', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('quantity_received', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('item_status', orderitemstatus, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parcel_id'], ['parcels.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_items_item_status'), 'order_items', ['item_status'], unique=False)
    op.create_index(op.f('ix_order_items_order_id'), 'order_items', ['order_id'], unique=False)
    op.create_index(op.f('ix_order_items_parcel_id'), 'order_items', ['parcel_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_order_items_parcel_id'), table_name='order_items')
    op.drop_index(op.f('ix_order_items_order_id'), table_name='order_items')
    op.drop_index(op.f('ix_order_items_item_status'), table_name='order_items')
    op.drop_table('order_items')
    
    op.drop_index(op.f('ix_parcels_user_id'), table_name='parcels')
    op.drop_index(op.f('ix_parcels_tracking_number'), table_name='parcels')
    op.drop_index(op.f('ix_parcels_status'), table_name='parcels')
    op.drop_table('parcels')
    
    op.drop_index(op.f('ix_orders_user_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_protection_end_date'), table_name='orders')
    op.drop_index(op.f('ix_orders_order_number_external'), table_name='orders')
    op.drop_table('orders')
    
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    
    # Drop enum types
    sa.Enum(name='orderitemstatus').drop(op.get_bind())
    sa.Enum(name='parcelstatus').drop(op.get_bind())
    sa.Enum(name='maincurrency').drop(op.get_bind())
