"""Order Pydantic schemas for API validation."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class OrderBase(BaseModel):
    """Base order schema with common fields."""
    platform: str = Field(..., max_length=64)
    order_number_external: str = Field(..., max_length=128)
    order_date: datetime
    protection_end_date: datetime | None = None
    price_original: Decimal = Field(..., ge=0, decimal_places=2)
    currency_original: str = Field(..., max_length=3)
    exchange_rate_frozen: Decimal = Field(..., gt=0, decimal_places=6)
    price_final_base: Decimal = Field(..., ge=0, decimal_places=2)
    is_price_estimated: bool = True
    comment: str | None = None


class OrderCreate(OrderBase):
    """Schema for creating a new order."""
    pass


class OrderUpdate(BaseModel):
    """Schema for updating order. All fields are optional."""
    platform: str | None = Field(None, max_length=64)
    order_number_external: str | None = Field(None, max_length=128)
    order_date: datetime | None = None
    protection_end_date: datetime | None = None
    price_original: Decimal | None = Field(None, ge=0, decimal_places=2)
    currency_original: str | None = Field(None, max_length=3)
    exchange_rate_frozen: Decimal | None = Field(None, gt=0, decimal_places=6)
    price_final_base: Decimal | None = Field(None, ge=0, decimal_places=2)
    is_price_estimated: bool | None = None
    comment: str | None = None


class OrderRead(OrderBase):
    """Schema for reading order data (response)."""
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class OrderWithItems(OrderRead):
    """Order with related order items."""
    order_items: list["OrderItemRead"] = []
    
    model_config = ConfigDict(from_attributes=True)


# Forward reference for OrderItemRead
from app.schemas.order_item import OrderItemRead  # noqa: E402
OrderWithItems.model_rebuild()
