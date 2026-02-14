"""Parcel service layer."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.parcel import Parcel
from app.schemas.parcel import ParcelCreate, ParcelUpdate
from app.core.exceptions import NotFoundException


async def get_parcel_by_id(db: AsyncSession, parcel_id: str, load_items: bool = False) -> Parcel:
    """Get parcel by ID."""
    query = select(Parcel).where(Parcel.id == parcel_id)
    if load_items:
        query = query.options(selectinload(Parcel.order_items))
    
    result = await db.execute(query)
    parcel = result.scalar_one_or_none()
    if not parcel:
        raise NotFoundException("Parcel", parcel_id)
    return parcel


async def get_user_parcels(
    db: AsyncSession, 
    user_id: str, 
    skip: int = 0, 
    limit: int = 100,
    load_items: bool = False
) -> list[Parcel]:
    """Get all parcels for a user."""
    query = select(Parcel).where(Parcel.user_id == user_id)
    
    if load_items:
        query = query.options(selectinload(Parcel.order_items))
    
    query = query.offset(skip).limit(limit).order_by(Parcel.created_at.desc())
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_parcel(db: AsyncSession, user_id: str, parcel_data: ParcelCreate) -> Parcel:
    """Create a new parcel."""
    parcel = Parcel(
        user_id=user_id,
        order_id=parcel_data.order_id,
        tracking_number=parcel_data.tracking_number,
        carrier_slug=parcel_data.carrier_slug,
        status=parcel_data.status,
        tracking_updated_at=parcel_data.tracking_updated_at,
        weight_kg=parcel_data.weight_kg
    )
    db.add(parcel)
    await db.commit()
    await db.refresh(parcel)
    return parcel


async def update_parcel(
    db: AsyncSession, 
    parcel_id: str, 
    user_id: str, 
    parcel_data: ParcelUpdate
) -> Parcel:
    """Update parcel."""
    parcel = await get_parcel_by_id(db, parcel_id)
    
    # Authorization check
    if parcel.user_id != user_id:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("You can only update your own parcels")
    
    # Update fields
    update_data = parcel_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(parcel, field, value)
    
    await db.commit()
    await db.refresh(parcel)
    return parcel


async def delete_parcel(db: AsyncSession, parcel_id: str, user_id: str) -> None:
    """Delete parcel."""
    parcel = await get_parcel_by_id(db, parcel_id)
    
    # Authorization check
    if parcel.user_id != user_id:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("You can only delete your own parcels")
    
    await db.delete(parcel)
    await db.commit()
