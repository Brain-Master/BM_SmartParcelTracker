"""User Pydantic schemas for API validation."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.enums import MainCurrency


class UserBase(BaseModel):
    """Base user schema with common fields."""
    email: EmailStr
    main_currency: MainCurrency = MainCurrency.RUB


class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user. All fields are optional."""
    email: EmailStr | None = None
    main_currency: MainCurrency | None = None
    password: str | None = None


class UserRead(UserBase):
    """Schema for reading user data (response)."""
    id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserInDB(UserRead):
    """Internal schema with hashed password."""
    hashed_password: str
