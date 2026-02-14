"""Orders — Финансовая сущность (Чек). What we paid for."""
from decimal import Decimal
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, NUMERIC
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid

ZERO = Decimal("0")


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

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
    platform: Mapped[str] = mapped_column(String(64), nullable=False)  # AliExpress, Ozon, Amazon
    order_number_external: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    protection_end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )  # Critical for alerts

    # Financial block
    price_original: Mapped[Decimal] = mapped_column(NUMERIC(14, 2), nullable=False)
    currency_original: Mapped[str] = mapped_column(String(3), nullable=False)
    exchange_rate_frozen: Mapped[Decimal] = mapped_column(NUMERIC(12, 6), nullable=False)
    price_final_base: Mapped[Decimal] = mapped_column(NUMERIC(14, 2), nullable=False)
    is_price_estimated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipping_cost: Mapped[Decimal | None] = mapped_column(NUMERIC(10, 2), nullable=True)
    customs_cost: Mapped[Decimal | None] = mapped_column(NUMERIC(10, 2), nullable=True)

    user = relationship("User", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order")
    parcels = relationship("Parcel", back_populates="order")

    @property
    def total_items_cost(self) -> Decimal:
        """Sum of (price_per_item * quantity_ordered) for all order items."""
        return sum(
            (item.price_per_item or ZERO) * item.quantity_ordered
            for item in self.order_items
        )

    @property
    def total_order_cost(self) -> Decimal:
        """Total order cost = items + shipping + customs."""
        return (
            self.total_items_cost
            + (self.shipping_cost or ZERO)
            + (self.customs_cost or ZERO)
        )
