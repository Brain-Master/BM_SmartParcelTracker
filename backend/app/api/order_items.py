"""OrderItem API endpoints."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.order_item import OrderItemCreate, OrderItemRead, OrderItemUpdate
from app.services import order_item_service

router = APIRouter()


@router.post("/", response_model=OrderItemRead, status_code=status.HTTP_201_CREATED)
async def create_order_item(
    item_data: OrderItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new order item."""
    item = await order_item_service.create_order_item_with_auth(
        db, item_data, str(current_user.id)
    )
    return item


@router.get("/{item_id}", response_model=OrderItemRead)
async def get_order_item(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get order item by ID."""
    item = await order_item_service.get_order_item_with_auth(
        db, item_id, str(current_user.id)
    )
    return item


@router.put("/{item_id}", response_model=OrderItemRead)
async def update_order_item(
    item_id: str,
    item_data: OrderItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update order item."""
    item = await order_item_service.update_order_item_with_auth(
        db, item_id, item_data, str(current_user.id)
    )
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_item(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete order item."""
    await order_item_service.delete_order_item_with_auth(
        db, item_id, str(current_user.id)
    )
