"""Store (platform) Pydantic schemas."""
from pydantic import BaseModel, Field, ConfigDict


class StoreBase(BaseModel):
    slug: str = Field(..., max_length=64)
    name: str | None = Field(None, max_length=128)


class StoreCreate(StoreBase):
    pass


class StoreRead(StoreBase):
    id: str
    model_config = ConfigDict(from_attributes=True)
