"""Carriers (delivery services) API — variant A: delete returns 409 if parcels use this carrier."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.carrier import CarrierCreate, CarrierRead
from app.services import carrier_service

router = APIRouter()


@router.get("/", response_model=list[CarrierRead])
async def list_carriers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all carriers (delivery services)."""
    return await carrier_service.get_carriers(db)


@router.post("/", response_model=CarrierRead, status_code=status.HTTP_201_CREATED)
async def create_carrier(
    data: CarrierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a carrier (delivery service). Slug must be unique."""
    return await carrier_service.create_carrier(db, data)


@router.delete("/{carrier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_carrier(
    carrier_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete carrier. Returns 409 if any parcel has this carrier."""
    await carrier_service.delete_carrier(db, carrier_id)
