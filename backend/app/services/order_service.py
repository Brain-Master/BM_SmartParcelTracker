"""Order service layer."""
import logging
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order
from app.schemas.order import OrderCreate, OrderUpdate
from app.core.exceptions import NotFoundException
from app.services import currency_service

logger = logging.getLogger(__name__)


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
    limit: int = 100,
    load_items: bool = False
) -> list[Order]:
    """Get all orders for a user."""
    query = select(Order).where(Order.user_id == user_id)
    
    if load_items:
        query = query.options(selectinload(Order.order_items))
    
    query = query.offset(skip).limit(limit).order_by(Order.created_at.desc())
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_order(
    db: AsyncSession, 
    user_id: str, 
    order_data: OrderCreate, 
    user_main_currency: str = "RUB"
) -> Order:
    """
    Create a new order with automatic currency conversion.
    
    If exchange_rate_frozen is not provided and currency_original != user_main_currency,
    the rate is fetched from CBR API and frozen.
    """
    # Determine exchange rate
    if order_data.exchange_rate_frozen is not None:
        # Manual rate provided by user
        exchange_rate_frozen = order_data.exchange_rate_frozen
        is_price_estimated = order_data.is_price_estimated or False
    elif order_data.currency_original != user_main_currency:
        # Auto-fetch rate from CBR
        try:
            rate = await currency_service.get_exchange_rate(
                order_data.currency_original,
                user_main_currency
            )
            exchange_rate_frozen = Decimal(str(rate))
            is_price_estimated = True
            logger.info(
                f"Auto-fetched exchange rate: {order_data.currency_original} → {user_main_currency} = {rate}"
            )
        except Exception as e:
            # Fallback: use 1.0 and mark as estimated
            logger.warning(f"Failed to get exchange rate from CBR: {e}. Using fallback rate=1.0")
            exchange_rate_frozen = Decimal("1.0")
            is_price_estimated = True
    else:
        # Same currency, no conversion
        exchange_rate_frozen = Decimal("1.0")
        is_price_estimated = False
    
    # Calculate final price
    if order_data.price_final_base is not None:
        price_final_base = order_data.price_final_base
    else:
        price_final_base = order_data.price_original * exchange_rate_frozen
    
    order = Order(
        user_id=user_id,
        platform=order_data.platform,
        order_number_external=order_data.order_number_external,
        order_date=order_data.order_date,
        protection_end_date=order_data.protection_end_date,
        price_original=order_data.price_original,
        currency_original=order_data.currency_original,
        exchange_rate_frozen=exchange_rate_frozen,
        price_final_base=price_final_base,
        is_price_estimated=is_price_estimated,
        comment=order_data.comment,
        shipping_cost=order_data.shipping_cost,
        customs_cost=order_data.customs_cost,
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
