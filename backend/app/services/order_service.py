"""Order service layer."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order
from app.schemas.order import OrderCreate, OrderUpdate
from app.core.exceptions import NotFoundException


async def get_order_by_id(db: AsyncSession, order_id: str, load_items: bool = False) -> Order:
    """Get order by ID."""
    query = select(Order).where(Order.id == order_id)
    if load_items:
        query = query.options(selectinload(Order.order_items))
    
    result = await db.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("Order", order_id)
    return order


async def get_user_orders(
    db: AsyncSession, 
    user_id: str, 
    skip: int = 0, 
    limit: int = 100
) -> list[Order]:
    """Get all orders for a user."""
    result = await db.execute(
        select(Order)
        .where(Order.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


async def create_order(db: AsyncSession, user_id: str, order_data: OrderCreate) -> Order:
    """Create a new order."""
    order = Order(
        user_id=user_id,
        platform=order_data.platform,
        order_number_external=order_data.order_number_external,
        order_date=order_data.order_date,
        protection_end_date=order_data.protection_end_date,
        price_original=order_data.price_original,
        currency_original=order_data.currency_original,
        exchange_rate_frozen=order_data.exchange_rate_frozen,
        price_final_base=order_data.price_final_base,
        is_price_estimated=order_data.is_price_estimated,
        comment=order_data.comment
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def update_order(
    db: AsyncSession, 
    order_id: str, 
    user_id: str, 
    order_data: OrderUpdate
) -> Order:
    """Update order."""
    order = await get_order_by_id(db, order_id)
    
    # Authorization check
    if order.user_id != user_id:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("You can only update your own orders")
    
    # Update fields
    update_data = order_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)
    
    await db.commit()
    await db.refresh(order)
    return order


async def delete_order(db: AsyncSession, order_id: str, user_id: str) -> None:
    """Delete order."""
    order = await get_order_by_id(db, order_id)
    
    # Authorization check
    if order.user_id != user_id:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("You can only delete your own orders")
    
    await db.delete(order)
    await db.commit()
