"""ParcelItem Pydantic schemas for API validation."""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ParcelItemBase(BaseModel):
    """Base parcel item schema."""
    order_item_id: str
    quantity: int = Field(..., ge=1, description="Quantity of this order item in the parcel")


class ParcelItemCreate(ParcelItemBase):
    """Schema for creating a parcel item (assign order item to parcel with quantity)."""
    pass


class ParcelItemUpdate(BaseModel):
    """Schema for updating quantity only."""
    quantity: int = Field(..., ge=1)


class ParcelItemRead(ParcelItemBase):
    """Schema for reading parcel item."""
    id: str
    parcel_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
