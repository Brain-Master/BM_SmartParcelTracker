"""Pydantic schemas for API request/response validation."""
from app.schemas.user import UserCreate, UserRead, UserUpdate, UserInDB
from app.schemas.order import OrderCreate, OrderRead, OrderUpdate, OrderWithItems
from app.schemas.parcel import ParcelCreate, ParcelRead, ParcelUpdate, ParcelWithItems
from app.schemas.order_item import OrderItemCreate, OrderItemRead, OrderItemUpdate
from app.schemas.parcel_item import ParcelItemCreate, ParcelItemRead, ParcelItemUpdate

__all__ = [
    # User schemas
    "UserCreate",
    "UserRead",
    "UserUpdate",
    "UserInDB",
    # Order schemas
    "OrderCreate",
    "OrderRead",
    "OrderUpdate",
    "OrderWithItems",
    # Parcel schemas
    "ParcelCreate",
    "ParcelRead",
    "ParcelUpdate",
    "ParcelWithItems",
    # OrderItem schemas
    "OrderItemCreate",
    "OrderItemRead",
    "OrderItemUpdate",
    "ParcelItemCreate",
    "ParcelItemRead",
    "ParcelItemUpdate",
]
