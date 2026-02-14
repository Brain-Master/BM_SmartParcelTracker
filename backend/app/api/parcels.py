"""Parcels API."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.parcel import ParcelCreate, ParcelRead, ParcelUpdate, ParcelWithItems
from app.services import parcel_service

router = APIRouter()


@router.get("/", response_model=list[ParcelRead | ParcelWithItems])
async def list_parcels(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    include_items: bool = Query(False, description="Include order items in response"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all parcels for the current user."""
    parcels = await parcel_service.get_user_parcels(
        db, str(current_user.id), skip, limit, load_items=include_items
    )
    return parcels


@router.get("/{parcel_id}", response_model=ParcelRead)
async def get_parcel(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific parcel."""
    parcel = await parcel_service.get_parcel_by_id(db, parcel_id)
    # Authorization check
    if parcel.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return parcel


@router.post("/", response_model=ParcelRead, status_code=status.HTTP_201_CREATED)
async def create_parcel(
    parcel_data: ParcelCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new parcel."""
    parcel = await parcel_service.create_parcel(db, current_user.id, parcel_data)
    return parcel


@router.put("/{parcel_id}", response_model=ParcelRead)
async def update_parcel(
    parcel_id: str,
    parcel_data: ParcelUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a parcel."""
    parcel = await parcel_service.update_parcel(db, parcel_id, current_user.id, parcel_data)
    return parcel


@router.delete("/{parcel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parcel(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a parcel."""
    await parcel_service.delete_parcel(db, parcel_id, current_user.id)
