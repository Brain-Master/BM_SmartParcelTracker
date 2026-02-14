"""OrderItem Pydantic schemas for API validation."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import OrderItemStatus


class OrderItemBase(BaseModel):
    """Base order item schema with common fields."""
    item_name: str = Field(..., max_length=512)
    image_url: str | None = Field(None, max_length=1024)
    tags: list[str] = Field(default_factory=list)
    quantity_ordered: int = Field(1, ge=1)
    quantity_received: int = Field(0, ge=0)
    price_per_item: Decimal | None = Field(None, ge=0, decimal_places=2)
    item_status: OrderItemStatus = OrderItemStatus.Seller_Packing


class OrderItemCreateNested(OrderItemBase):
    """Schema for creating an order item inline with order (no order_id)."""
    parcel_id: str | None = None


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
    price_per_item: Decimal | None = Field(None, ge=0, decimal_places=2)
    item_status: OrderItemStatus | None = None


class OrderItemRead(OrderItemBase):
    """Schema for reading order item data (response)."""
    id: str
    order_id: str
    parcel_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderItemReadWithOrderDeleted(OrderItemRead):
    """Order item with order deleted flag (for parcel content when order is soft-deleted)."""
    order_deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderItemInParcel(BaseModel):
    """Quantity of this order item in one parcel (split shipments)."""
    parcel_id: str
    quantity: int = Field(..., ge=1)


class OrderItemReadWithParcels(OrderItemRead):
    """Order item with parcel split: in_parcels, quantity_in_parcels, remaining_quantity."""
    in_parcels: list[OrderItemInParcel] = Field(default_factory=list)
    quantity_in_parcels: int = Field(0, ge=0)
    remaining_quantity: int = Field(0, ge=0)

    model_config = ConfigDict(from_attributes=True)
