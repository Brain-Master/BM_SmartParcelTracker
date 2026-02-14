"""Users — Пользователи. main_currency for reporting."""
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid
from app.models.enums import MainCurrency


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=gen_uuid,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    main_currency: Mapped[MainCurrency] = mapped_column(
        default=MainCurrency.RUB,
        nullable=False,
    )

    orders = relationship("Order", back_populates="user")
    parcels = relationship("Parcel", back_populates="user")
