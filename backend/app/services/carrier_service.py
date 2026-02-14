"""Carrier (delivery service) — variant A: delete forbidden when parcels use this carrier."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.parcel import Parcel
from app.models.carrier import Carrier
from app.schemas.carrier import CarrierCreate
from app.core.exceptions import NotFoundException, ConflictException, AlreadyExistsException


async def get_carriers(db: AsyncSession) -> list[Carrier]:
    """List all carriers (delivery services)."""
    result = await db.execute(select(Carrier).order_by(Carrier.slug))
    return list(result.scalars().all())


async def get_carrier_by_id(db: AsyncSession, carrier_id: str) -> Carrier:
    """Get carrier by ID."""
    carrier = await db.get(Carrier, carrier_id)
    if not carrier:
        raise NotFoundException("Carrier", carrier_id)
    return carrier


async def get_carrier_by_slug(db: AsyncSession, slug: str) -> Carrier | None:
    """Get carrier by slug."""
    result = await db.execute(select(Carrier).where(Carrier.slug == slug))
    return result.scalar_one_or_none()


async def create_carrier(db: AsyncSession, data: CarrierCreate) -> Carrier:
    """Create a carrier. Slug must be unique."""
    existing = await get_carrier_by_slug(db, data.slug)
    if existing:
        raise AlreadyExistsException("Carrier", "slug", data.slug)
    carrier = Carrier(slug=data.slug, name=data.name)
    db.add(carrier)
    await db.commit()
    await db.refresh(carrier)
    return carrier


async def delete_carrier(db: AsyncSession, carrier_id: str) -> None:
    """Delete carrier. Raises 409 if any parcel has parcel.carrier_slug == carrier.slug."""
    carrier = await get_carrier_by_id(db, carrier_id)
    r = await db.execute(select(Parcel.id).where(Parcel.carrier_slug == carrier.slug).limit(1))
    if r.scalar_one_or_none() is not None:
        raise ConflictException(
            "Удалить нельзя: есть посылки с этой службой доставки."
        )
    await db.delete(carrier)
    await db.commit()
