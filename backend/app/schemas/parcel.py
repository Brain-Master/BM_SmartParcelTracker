"""Parcel Pydantic schemas for API validation."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import ParcelStatus


class ParcelBase(BaseModel):
    """Base parcel schema with common fields."""
    tracking_number: str = Field(..., max_length=128)
    carrier_slug: str = Field(..., max_length=64)
    label: str | None = Field(None, max_length=128)
    status: ParcelStatus = ParcelStatus.Created
    tracking_updated_at: datetime | None = None
    weight_kg: Decimal | None = Field(None, ge=0, decimal_places=3)
    is_archived: bool = False


class ParcelCreate(ParcelBase):
    """Schema for creating a new parcel."""


class ParcelUpdate(BaseModel):
    """Schema for updating parcel. All fields are optional."""
    tracking_number: str | None = Field(None, max_length=128)
    carrier_slug: str | None = Field(None, max_length=64)
    label: str | None = Field(None, max_length=128)
    status: ParcelStatus | None = None
    tracking_updated_at: datetime | None = None
    weight_kg: Decimal | None = Field(None, ge=0, decimal_places=3)
    is_archived: bool | None = None


class ParcelRead(ParcelBase):
    """Schema for reading parcel data (response)."""
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ParcelWithItems(ParcelRead):
    """Parcel with related order items. Items include order_deleted_at for UI (заказ удалён)."""
    order_items: list["OrderItemReadWithOrderDeleted"] = []

    model_config = ConfigDict(from_attributes=True)


# Forward reference
from app.schemas.order_item import OrderItemReadWithOrderDeleted  # noqa: E402
ParcelWithItems.model_rebuild()
