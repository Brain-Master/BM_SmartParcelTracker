"""Orders API."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.order import OrderCreate, OrderRead, OrderUpdate
from app.services import order_service

router = APIRouter()


@router.get("/", response_model=list[OrderRead])
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all orders for the current user."""
    orders = await order_service.get_user_orders(db, current_user.id, skip, limit)
    return orders


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
