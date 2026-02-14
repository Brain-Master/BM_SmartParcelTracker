"""Parcel items API (split shipments): items in a parcel with quantity."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.parcel_item import ParcelItemCreate, ParcelItemRead, ParcelItemUpdate
from app.services import parcel_item_service

router = APIRouter(prefix="/{parcel_id}/items", tags=["parcel-items"])


@router.get("/", response_model=list[ParcelItemRead])
async def list_parcel_items(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all order items in this parcel (with quantities)."""
    from app.services.parcel_service import get_parcel_by_id
    parcel = await get_parcel_by_id(db, parcel_id)
    if parcel.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    items = await parcel_item_service.get_parcel_items_by_parcel(db, parcel_id)
    return items


@router.post("/", response_model=ParcelItemRead, status_code=status.HTTP_201_CREATED)
async def create_parcel_item(
    parcel_id: str,
    item_data: ParcelItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an order item to this parcel with given quantity (split shipments)."""
    return await parcel_item_service.create_parcel_item(
        db, parcel_id, str(current_user.id), item_data
    )


@router.get("/{item_id}", response_model=ParcelItemRead)
async def get_parcel_item(
    parcel_id: str,
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get one parcel item by ID."""
    from app.services.parcel_service import get_parcel_by_id
    parcel = await get_parcel_by_id(db, parcel_id)
    if parcel.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    item = await parcel_item_service.get_parcel_item_by_id(db, item_id)
    if item.parcel_id != parcel_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ParcelItem not in this parcel")
    return item


@router.put("/{item_id}", response_model=ParcelItemRead)
async def update_parcel_item(
    parcel_id: str,
    item_id: str,
    item_data: ParcelItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update quantity of order item in this parcel."""
    item = await parcel_item_service.get_parcel_item_by_id(db, item_id)
    if item.parcel_id != parcel_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ParcelItem not in this parcel")
    return await parcel_item_service.update_parcel_item(db, item_id, str(current_user.id), item_data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parcel_item(
    parcel_id: str,
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove order item from this parcel."""
    item = await parcel_item_service.get_parcel_item_by_id(db, item_id)
    if item.parcel_id != parcel_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ParcelItem not in this parcel")
    await parcel_item_service.delete_parcel_item(db, item_id, str(current_user.id))
