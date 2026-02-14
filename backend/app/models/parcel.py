"""Parcels — Логистическая сущность (Коробка). Physical object in transit."""
from decimal import Decimal
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, NUMERIC
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid
from app.models.enums import ParcelStatus


class Parcel(Base, TimestampMixin):
    __tablename__ = "parcels"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=gen_uuid,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tracking_number: Mapped[str] = mapped_column(String(128), nullable=False, index=True)  # NOT unique
    carrier_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)  # Human-readable name
    status: Mapped[ParcelStatus] = mapped_column(
        default=ParcelStatus.Created,
        nullable=False,
        index=True,
    )
    tracking_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    weight_kg: Mapped[Decimal | None] = mapped_column(NUMERIC(8, 3), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="parcels")
    order_items = relationship("OrderItem", back_populates="parcel")
    parcel_items = relationship("ParcelItem", back_populates="parcel", cascade="all, delete-orphan")
