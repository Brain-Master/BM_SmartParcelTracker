"""Stores (platforms) API — variant A: delete returns 409 if orders use this store."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.store import StoreCreate, StoreRead
from app.services import store_service

router = APIRouter()


@router.get("/", response_model=list[StoreRead])
async def list_stores(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all stores (platforms)."""
    return await store_service.get_stores(db)


@router.post("/", response_model=StoreRead, status_code=status.HTTP_201_CREATED)
async def create_store(
    data: StoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a store (platform). Slug must be unique."""
    return await store_service.create_store(db, data)


@router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store(
    store_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete store. Returns 409 if any order has this store as platform."""
    await store_service.delete_store(db, store_id)
