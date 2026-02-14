"""ParcelItem service layer (split shipments)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.parcel_item import ParcelItem
from app.models.order_item import OrderItem
from app.schemas.parcel_item import ParcelItemCreate, ParcelItemUpdate
from app.core.exceptions import NotFoundException, UnauthorizedException
from app.services.parcel_service import get_parcel_by_id


async def get_parcel_item_by_id(db: AsyncSession, parcel_item_id: str) -> ParcelItem:
    """Get parcel item by ID."""
    result = await db.execute(
        select(ParcelItem).where(ParcelItem.id == parcel_item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("ParcelItem", parcel_item_id)
    return item


async def get_parcel_items_by_parcel(db: AsyncSession, parcel_id: str) -> list[ParcelItem]:
    """Get all parcel items for a parcel."""
    result = await db.execute(
        select(ParcelItem).where(ParcelItem.parcel_id == parcel_id)
    )
    return list(result.scalars().all())


async def get_parcel_items_grouped_by_order_item(
    db: AsyncSession, order_item_ids: list[str]
) -> dict[str, list[tuple[str, int]]]:
    """For each order_item_id return list of (parcel_id, quantity). Used to enrich order items with split data."""
    if not order_item_ids:
        return {}
    result = await db.execute(
        select(ParcelItem.order_item_id, ParcelItem.parcel_id, ParcelItem.quantity).where(
            ParcelItem.order_item_id.in_(order_item_ids)
        )
    )
    rows = result.all()
    out: dict[str, list[tuple[str, int]]] = {oid: [] for oid in order_item_ids}
    for order_item_id, parcel_id, quantity in rows:
        out[order_item_id].append((parcel_id, quantity))
    return out


async def create_parcel_item(
    db: AsyncSession,
    parcel_id: str,
    user_id: str,
    data: ParcelItemCreate,
) -> ParcelItem:
    """Add an order item to a parcel with given quantity. Checks parcel and order item belong to user."""
    parcel = await get_parcel_by_id(db, parcel_id)
    if parcel.user_id != user_id:
        raise UnauthorizedException("You can only add items to your own parcels")

    # Verify order_item exists and belongs to user's order
    result = await db.execute(
        select(OrderItem).where(OrderItem.id == data.order_item_id)
    )
    order_item = result.scalar_one_or_none()
    if not order_item:
        raise NotFoundException("OrderItem", data.order_item_id)
    # Load order to check user_id
    from app.models.order import Order
    order_result = await db.execute(select(Order).where(Order.id == order_item.order_id))
    order = order_result.scalar_one_or_none()
    if not order or order.user_id != user_id:
        raise UnauthorizedException("Order item must belong to your order")

    # Check total quantity across parcels doesn't exceed quantity_ordered (optional business rule)
    existing = await db.execute(
        select(ParcelItem).where(ParcelItem.order_item_id == data.order_item_id)
    )
    total_in_parcels = sum(pi.quantity for pi in existing.scalars().all())
    if total_in_parcels + data.quantity > order_item.quantity_ordered:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Total quantity in parcels ({total_in_parcels + data.quantity}) exceeds ordered ({order_item.quantity_ordered})",
        )

    parcel_item = ParcelItem(
        parcel_id=parcel_id,
        order_item_id=data.order_item_id,
        quantity=data.quantity,
    )
    db.add(parcel_item)
    await db.commit()
    await db.refresh(parcel_item)
    return parcel_item


async def update_parcel_item(
    db: AsyncSession,
    parcel_item_id: str,
    user_id: str,
    data: ParcelItemUpdate,
) -> ParcelItem:
    """Update parcel item quantity. Ensures total across parcels does not exceed quantity_ordered."""
    parcel_item = await get_parcel_item_by_id(db, parcel_item_id)
    parcel = await get_parcel_by_id(db, parcel_item.parcel_id)
    if parcel.user_id != user_id:
        raise UnauthorizedException("You can only update items in your own parcels")

    order_item_result = await db.execute(
        select(OrderItem).where(OrderItem.id == parcel_item.order_item_id)
    )
    order_item = order_item_result.scalar_one_or_none()
    if not order_item:
        raise NotFoundException("OrderItem", parcel_item.order_item_id)

    existing_all = await db.execute(
        select(ParcelItem).where(ParcelItem.order_item_id == parcel_item.order_item_id)
    )
    total_others = sum(pi.quantity for pi in existing_all.scalars().all() if pi.id != parcel_item_id)
    if total_others + data.quantity > order_item.quantity_ordered:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Total quantity in parcels ({total_others + data.quantity}) would exceed ordered ({order_item.quantity_ordered})",
        )

    parcel_item.quantity = data.quantity
    await db.commit()
    await db.refresh(parcel_item)
    return parcel_item


async def delete_parcel_item(db: AsyncSession, parcel_item_id: str, user_id: str) -> None:
    """Remove order item from parcel."""
    parcel_item = await get_parcel_item_by_id(db, parcel_item_id)
    parcel = await get_parcel_by_id(db, parcel_item.parcel_id)
    if parcel.user_id != user_id:
        raise UnauthorizedException("You can only remove items from your own parcels")
    await db.delete(parcel_item)
    await db.commit()
