"""Carrier (delivery service) Pydantic schemas."""
from pydantic import BaseModel, Field, ConfigDict


class CarrierBase(BaseModel):
    slug: str = Field(..., max_length=64)
    name: str | None = Field(None, max_length=128)


class CarrierCreate(CarrierBase):
    pass


class CarrierRead(CarrierBase):
    id: str
    model_config = ConfigDict(from_attributes=True)
