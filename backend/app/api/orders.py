"""Orders API."""
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.order import OrderCreate, OrderRead, OrderUpdate, OrderWithItems, OrderWithItemsEnriched
from app.schemas.order_item import OrderItemInParcel, OrderItemRead, OrderItemReadWithParcels
from app.services import order_service, parcel_item_service

router = APIRouter()


def _order_total_from_items(order) -> Decimal | None:
    """Compute total_order_cost from items + shipping + customs when order has items."""
    if not getattr(order, "order_items", None):
        return None
    items_sum = sum(
        (getattr(i, "price_per_item") or 0) * getattr(i, "quantity_ordered", 0)
        for i in order.order_items
    )
    shipping = getattr(order, "shipping_cost") or 0
    customs = getattr(order, "customs_cost") or 0
    return Decimal(str(items_sum)) + Decimal(str(shipping)) + Decimal(str(customs))


@router.get("/", response_model=list[OrderRead | OrderWithItems | OrderWithItemsEnriched])
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    include_items: bool = Query(False, description="Include order items in response"),
    include_archived: bool = Query(False, description="Include archived orders"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all orders for the current user. With include_items=True returns items enriched by parcel split (in_parcels, remaining_quantity)."""
    orders = await order_service.get_user_orders(
        db, str(current_user.id), skip, limit, load_items=include_items, include_archived=include_archived
    )
    if not include_items or not orders:
        return list(orders)

    # Enrich order items with ParcelItem data (split shipments)
    all_item_ids = [item.id for o in orders for item in o.order_items]
    parcel_map = await parcel_item_service.get_parcel_items_grouped_by_order_item(db, all_item_ids)

    result = []
    for o in orders:
        enriched_items = []
        for item in o.order_items:
            in_parcels_list = parcel_map.get(item.id, [])
            qty_in = sum(q for _, q in in_parcels_list)
            remaining = item.quantity_ordered - qty_in
            base = OrderItemRead.model_validate(item).model_dump()
            enriched_items.append(OrderItemReadWithParcels(
                **base,
                in_parcels=[OrderItemInParcel(parcel_id=pid, quantity=q) for pid, q in in_parcels_list],
                quantity_in_parcels=qty_in,
                remaining_quantity=remaining,
            ))
        result.append(OrderWithItemsEnriched(
            **OrderRead.model_validate(o).model_dump(),
            order_items=enriched_items,
            total_order_cost=_order_total_from_items(o),
        ))
    return result


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific order."""
    order = await order_service.get_order_by_id(db, order_id)
    # Authorization check
    if order.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return order


@router.post("/", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new order with automatic currency conversion."""
    order = await order_service.create_order(
        db, 
        current_user.id, 
        order_data,
        user_main_currency=current_user.main_currency
    )
    return order


@router.put("/{order_id}", response_model=OrderRead)
async def update_order(
    order_id: str,
    order_data: OrderUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an order."""
    order = await order_service.update_order(db, order_id, current_user.id, order_data)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an order."""
    await order_service.delete_order(db, order_id, current_user.id)
