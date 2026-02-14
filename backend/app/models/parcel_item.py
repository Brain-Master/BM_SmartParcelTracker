"""ParcelItem — junction table: Parcel ↔ OrderItem with quantity (split shipments)."""
from sqlalchemy import CheckConstraint, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid


class ParcelItem(Base, TimestampMixin):
    """How many units of an order item are in a given parcel (supports split shipments)."""
    __tablename__ = "parcel_items"
    __table_args__ = (
        UniqueConstraint("parcel_id", "order_item_id", name="uq_parcel_item"),
        CheckConstraint("quantity > 0", name="ck_parcel_item_quantity_positive"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=gen_uuid,
    )
    parcel_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("parcels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("order_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    parcel = relationship("Parcel", back_populates="parcel_items")
    order_item = relationship("OrderItem", back_populates="parcel_items")
