"""Store (platform) service — variant A: delete forbidden when orders use this platform."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.store import Store
from app.schemas.store import StoreCreate
from app.core.exceptions import NotFoundException, ConflictException, AlreadyExistsException


async def get_stores(db: AsyncSession) -> list[Store]:
    """List all stores (platforms)."""
    result = await db.execute(select(Store).order_by(Store.slug))
    return list(result.scalars().all())


async def get_store_by_id(db: AsyncSession, store_id: str) -> Store:
    """Get store by ID."""
    store = await db.get(Store, store_id)
    if not store:
        raise NotFoundException("Store", store_id)
    return store


async def get_store_by_slug(db: AsyncSession, slug: str) -> Store | None:
    """Get store by slug."""
    result = await db.execute(select(Store).where(Store.slug == slug))
    return result.scalar_one_or_none()


async def create_store(db: AsyncSession, data: StoreCreate) -> Store:
    """Create a store. Slug must be unique."""
    existing = await get_store_by_slug(db, data.slug)
    if existing:
        raise AlreadyExistsException("Store", "slug", data.slug)
    store = Store(slug=data.slug, name=data.name)
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return store


async def delete_store(db: AsyncSession, store_id: str) -> None:
    """Delete store. Raises 409 if any order has order.platform == store.slug."""
    store = await get_store_by_id(db, store_id)
    r = await db.execute(select(Order.id).where(Order.platform == store.slug).limit(1))
    if r.scalar_one_or_none() is not None:
        raise ConflictException(
            "Удалить нельзя: есть заказы, привязанные к этому магазину."
        )
    await db.delete(store)
    await db.commit()
