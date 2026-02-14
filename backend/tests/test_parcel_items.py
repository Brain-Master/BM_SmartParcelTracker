"""Tests for ParcelItem API (split shipments)."""
from datetime import datetime, UTC

import pytest
from httpx import AsyncClient

from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.parcel import Parcel
from app.models.parcel_item import ParcelItem
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_parcel_item(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
    """Create order and parcel, then add order item to parcel via ParcelItem."""
    # Create tables (conftest does create_all, so ParcelItem is there)
    user_id = await _get_user_id_from_db(db_session)
    order = await _create_order_in_db(db_session, user_id)
    item = await _create_order_item_in_db(db_session, order.id, quantity_ordered=3)
    parcel = await _create_parcel_in_db(db_session, user_id)

    # Add item to parcel with quantity 2
    response = await client.post(
        f"/api/parcels/{parcel.id}/items/",
        json={"order_item_id": item.id, "quantity": 2},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["parcel_id"] == parcel.id
    assert data["order_item_id"] == item.id
    assert data["quantity"] == 2
    assert "id" in data


@pytest.mark.asyncio
async def test_list_parcel_items(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
    """List parcel items for a parcel."""
    user_id = await _get_user_id_from_db(db_session)
    order = await _create_order_in_db(db_session, user_id)
    item = await _create_order_item_in_db(db_session, order.id)
    parcel = await _create_parcel_in_db(db_session, user_id)
    await _create_parcel_item_in_db(db_session, parcel.id, item.id, quantity=1)

    response = await client.get(
        f"/api/parcels/{parcel.id}/items/",
        headers=auth_headers,
    )
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["quantity"] == 1
    assert items[0]["order_item_id"] == item.id


@pytest.mark.asyncio
async def test_parcel_item_quantity_exceeds_ordered(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
    """Adding more than quantity_ordered should return 400."""
    user_id = await _get_user_id_from_db(db_session)
    order = await _create_order_in_db(db_session, user_id)
    item = await _create_order_item_in_db(db_session, order.id, quantity_ordered=2)
    parcel = await _create_parcel_in_db(db_session, user_id)

    response = await client.post(
        f"/api/parcels/{parcel.id}/items/",
        json={"order_item_id": item.id, "quantity": 5},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "exceeds ordered" in response.json().get("detail", "").lower() or ""


async def _get_user_id_from_db(db: AsyncSession) -> str:
    from sqlalchemy import select
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        # Create user via API is done in auth_headers; we need user in DB for direct create
        # So we rely on auth_headers having run first - then one user exists
        raise RuntimeError("No user in DB - ensure auth_headers fixture ran first")
    return str(user.id)


async def _create_order_in_db(db: AsyncSession, user_id: str) -> Order:
    from decimal import Decimal
    order = Order(
        user_id=user_id,
        platform="AliExpress",
        order_number_external="AE-TEST-001",
        order_date=datetime.now(UTC),
        price_original=Decimal("100.00"),
        currency_original="USD",
        exchange_rate_frozen=Decimal("92.5"),
        price_final_base=Decimal("9250.00"),
        is_price_estimated=True,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def _create_order_item_in_db(
    db: AsyncSession,
    order_id: str,
    quantity_ordered: int = 1,
) -> OrderItem:
    item = OrderItem(
        order_id=order_id,
        item_name="Test item",
        quantity_ordered=quantity_ordered,
        quantity_received=0,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def _create_parcel_in_db(db: AsyncSession, user_id: str) -> Parcel:
    from app.models.enums import ParcelStatus
    parcel = Parcel(
        user_id=user_id,
        tracking_number="RR123",
        carrier_slug="russian-post",
        status=ParcelStatus.Created,
    )
    db.add(parcel)
    await db.commit()
    await db.refresh(parcel)
    return parcel


async def _create_parcel_item_in_db(
    db: AsyncSession,
    parcel_id: str,
    order_item_id: str,
    quantity: int = 1,
) -> ParcelItem:
    pi = ParcelItem(
        parcel_id=parcel_id,
        order_item_id=order_item_id,
        quantity=quantity,
    )
    db.add(pi)
    await db.commit()
    await db.refresh(pi)
    return pi
