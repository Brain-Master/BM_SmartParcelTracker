"""OrderItem Pydantic schemas for API validation."""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import OrderItemStatus


class OrderItemBase(BaseModel):
    """Base order item schema with common fields."""
    item_name: str = Field(..., max_length=512)
    image_url: str | None = Field(None, max_length=1024)
    tags: list[str] = Field(default_factory=list)
    quantity_ordered: int = Field(1, ge=1)
    quantity_received: int = Field(0, ge=0)
    item_status: OrderItemStatus = OrderItemStatus.Waiting_Shipment


class OrderItemCreate(OrderItemBase):
    """Schema for creating a new order item."""
    order_id: str
    parcel_id: str | None = None


class OrderItemUpdate(BaseModel):
    """Schema for updating order item. All fields are optional."""
    parcel_id: str | None = None
    item_name: str | None = Field(None, max_length=512)
    image_url: str | None = Field(None, max_length=1024)
    tags: list[str] | None = None
    quantity_ordered: int | None = Field(None, ge=1)
    quantity_received: int | None = Field(None, ge=0)
    item_status: OrderItemStatus | None = None


class OrderItemRead(OrderItemBase):
    """Schema for reading order item data (response)."""
    id: str
    order_id: str
    parcel_id: str | None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
