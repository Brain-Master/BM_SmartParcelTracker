"""OrderItems — Связующее звено / SKU. Order ↔ Parcel; supports split shipments."""
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid
from app.models.enums import OrderItemStatus


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=gen_uuid,
    )
    order_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parcel_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("parcels.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    item_name: Mapped[str] = mapped_column(String(512), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    item_status: Mapped[OrderItemStatus] = mapped_column(
        default=OrderItemStatus.Waiting_Shipment,
        nullable=False,
        index=True,
    )

    order = relationship("Order", back_populates="order_items")
    parcel = relationship("Parcel", back_populates="order_items")
