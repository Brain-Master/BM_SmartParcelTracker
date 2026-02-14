"""Parcel Pydantic schemas for API validation."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import ParcelStatus


class ParcelBase(BaseModel):
    """Base parcel schema with common fields."""
    tracking_number: str = Field(..., max_length=128)
    carrier_slug: str = Field(..., max_length=64)
    status: ParcelStatus = ParcelStatus.Created
    tracking_updated_at: datetime | None = None
    weight_kg: Decimal | None = Field(None, ge=0, decimal_places=3)


class ParcelCreate(ParcelBase):
    """Schema for creating a new parcel."""
    pass


class ParcelUpdate(BaseModel):
    """Schema for updating parcel. All fields are optional."""
    tracking_number: str | None = Field(None, max_length=128)
    carrier_slug: str | None = Field(None, max_length=64)
    status: ParcelStatus | None = None
    tracking_updated_at: datetime | None = None
    weight_kg: Decimal | None = Field(None, ge=0, decimal_places=3)


class ParcelRead(ParcelBase):
    """Schema for reading parcel data (response)."""
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ParcelWithItems(ParcelRead):
    """Parcel with related order items."""
    order_items: list["OrderItemRead"] = []
    
    model_config = ConfigDict(from_attributes=True)


# Forward reference for OrderItemRead
from app.schemas.order_item import OrderItemRead  # noqa: E402
ParcelWithItems.model_rebuild()
