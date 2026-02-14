"""Order service layer."""
import logging
from datetime import datetime, UTC
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, ZERO
from app.models.order_item import OrderItem
from app.models.parcel import Parcel
from app.models.parcel_item import ParcelItem
from app.schemas.order import OrderCreate, OrderUpdate
from app.core.exceptions import NotFoundException
from app.services import currency_service

logger = logging.getLogger(__name__)


async def recalculate_order_totals(db: AsyncSession, order_id: str) -> None:
    """
    Recompute price_original and price_final_base from order items + shipping + customs.
    price_original = Σ(price_per_item × quantity_ordered) + shipping_cost + customs_cost.
    price_final_base = price_original × exchange_rate_frozen.
    """
    order = await get_order_by_id(db, order_id, load_items=True)
    price_original = order.total_order_cost
    price_final_base = (price_original * order.exchange_rate_frozen).quantize(Decimal("0.01"))
    order.price_original = price_original
    order.price_final_base = price_final_base
    await db.commit()


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
    load_items: bool = False,
    exclude_deleted: bool = True,
) -> list[Order]:
    """Get all orders for a user. By default excludes soft-deleted (deleted_at IS NOT NULL)."""
    query = select(Order).where(Order.user_id == user_id)
    if exclude_deleted:
        query = query.where(Order.deleted_at.is_(None))
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
    Create a new order (optionally with order_items in one request).
    If order_items are provided, price_original/price_final_base are computed after creating items.
    Otherwise they are taken from payload or default to 0.
    """
    # Determine exchange rate
    if order_data.exchange_rate_frozen is not None:
        exchange_rate_frozen = order_data.exchange_rate_frozen
        is_price_estimated = order_data.is_price_estimated if order_data.is_price_estimated is not None else False
    elif order_data.currency_original != user_main_currency:
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
            logger.warning(f"Failed to get exchange rate from CBR: {e}. Using fallback rate=1.0")
            exchange_rate_frozen = Decimal("1.0")
            is_price_estimated = True
    else:
        exchange_rate_frozen = Decimal("1.0")
        is_price_estimated = order_data.is_price_estimated if order_data.is_price_estimated is not None else False

    # Initial price (will be recalculated if order_items provided)
    price_original = order_data.price_original if order_data.price_original is not None else ZERO
    if order_data.price_final_base is not None:
        price_final_base = order_data.price_final_base
    else:
        price_final_base = (price_original * exchange_rate_frozen).quantize(Decimal("0.01"))

    order = Order(
        user_id=user_id,
        platform=order_data.platform,
        order_number_external=order_data.order_number_external,
        label=order_data.label,
        order_date=order_data.order_date,
        protection_end_date=order_data.protection_end_date,
        price_original=price_original,
        currency_original=order_data.currency_original,
        exchange_rate_frozen=exchange_rate_frozen,
        price_final_base=price_final_base,
        is_price_estimated=is_price_estimated,
        comment=order_data.comment,
        shipping_cost=order_data.shipping_cost,
        customs_cost=order_data.customs_cost,
    )
    db.add(order)
    await db.flush()

    if order_data.order_items:
        for nested in order_data.order_items:
            item = OrderItem(
                order_id=order.id,
                parcel_id=nested.parcel_id,
                item_name=nested.item_name,
                image_url=nested.image_url,
                tags=nested.tags,
                quantity_ordered=nested.quantity_ordered,
                quantity_received=nested.quantity_received,
                price_per_item=nested.price_per_item,
                item_status=nested.item_status,
            )
            db.add(item)
        await db.flush()
        await recalculate_order_totals(db, order.id)
        await db.refresh(order)
    else:
        await db.commit()
        await db.refresh(order)
    return order


async def update_order(
    db: AsyncSession, 
    order_id: str, 
    user_id: str, 
    order_data: OrderUpdate
) -> Order:
    """Update order; then recalculate price_original and price_final_base."""
    order = await get_order_by_id(db, order_id)
    if order.user_id != user_id:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("You can only update your own orders")
    update_data = order_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)
    await db.flush()
    await recalculate_order_totals(db, order_id)
    await db.refresh(order)
    return order


async def delete_order(db: AsyncSession, order_id: str, user_id: str) -> None:
    """
    Delete order (variant C — сторнирование).
    No parcels: hard delete. Only exclusive parcels: delete them and hard delete order.
    Any shared parcel: soft-delete order (set deleted_at).
    """
    from app.core.exceptions import UnauthorizedException

    order = await get_order_by_id(db, order_id, load_items=True)
    if order.user_id != user_id:
        raise UnauthorizedException("You can only delete your own orders")

    our_item_ids = {item.id for item in order.order_items}
    if not our_item_ids:
        await db.delete(order)
        await db.commit()
        return

    # Parcels that contain any of our order's items
    q_parcel_ids = (
        select(ParcelItem.parcel_id)
        .where(ParcelItem.order_item_id.in_(our_item_ids))
        .distinct()
    )
    r = await db.execute(q_parcel_ids)
    parcel_ids_to_consider = [row[0] for row in r.all()]

    exclusive_parcel_ids: list[str] = []
    for pid in parcel_ids_to_consider:
        # All order_items in this parcel
        q_items_in_parcel = (
            select(OrderItem.order_id)
            .join(ParcelItem, ParcelItem.order_item_id == OrderItem.id)
            .where(ParcelItem.parcel_id == pid)
            .distinct()
        )
        r2 = await db.execute(q_items_in_parcel)
        order_ids_in_parcel = {row[0] for row in r2.all()}
        if order_ids_in_parcel == {order_id}:
            exclusive_parcel_ids.append(pid)

    for pid in exclusive_parcel_ids:
        parcel = await db.get(Parcel, pid)
        if parcel:
            await db.delete(parcel)

    await db.flush()

    # Any parcel_item left for our order's items? (shared parcels)
    q_remaining = select(ParcelItem.id).where(
        ParcelItem.order_item_id.in_(our_item_ids)
    )
    r3 = await db.execute(q_remaining)
    has_shared = r3.scalar_one_or_none() is not None

    if has_shared:
        order.deleted_at = datetime.now(UTC)
        await db.commit()
    else:
        await db.delete(order)
        await db.commit()
