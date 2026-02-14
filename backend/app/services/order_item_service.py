"""OrderItem service layer."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order_item import OrderItem
from app.schemas.order_item import OrderItemCreate, OrderItemUpdate
from app.core.exceptions import NotFoundException


async def get_order_item_by_id(db: AsyncSession, item_id: str) -> OrderItem:
    """Get order item by ID."""
    result = await db.execute(select(OrderItem).where(OrderItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("OrderItem", item_id)
    return item


async def get_order_items_by_order(db: AsyncSession, order_id: str) -> list[OrderItem]:
    """Get all items for an order."""
    result = await db.execute(
        select(OrderItem).where(OrderItem.order_id == order_id)
    )
    return list(result.scalars().all())


async def get_order_items_by_parcel(db: AsyncSession, parcel_id: str) -> list[OrderItem]:
    """Get all items for a parcel."""
    result = await db.execute(
        select(OrderItem).where(OrderItem.parcel_id == parcel_id)
    )
    return list(result.scalars().all())


async def create_order_item(db: AsyncSession, item_data: OrderItemCreate) -> OrderItem:
    """Create a new order item."""
    item = OrderItem(
        order_id=item_data.order_id,
        parcel_id=item_data.parcel_id,
        item_name=item_data.item_name,
        image_url=item_data.image_url,
        tags=item_data.tags,
        quantity_ordered=item_data.quantity_ordered,
        quantity_received=item_data.quantity_received,
        item_status=item_data.item_status
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_order_item(
    db: AsyncSession, 
    item_id: str, 
    item_data: OrderItemUpdate
) -> OrderItem:
    """Update order item."""
    item = await get_order_item_by_id(db, item_id)
    
    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    
    await db.commit()
    await db.refresh(item)
    return item


async def delete_order_item(db: AsyncSession, item_id: str) -> None:
    """Delete order item."""
    item = await get_order_item_by_id(db, item_id)
    await db.delete(item)
    await db.commit()
