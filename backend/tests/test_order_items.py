"""Tests for order item endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_order_item(client: AsyncClient, auth_headers: dict):
    """Test creating an order item."""
    # First create an order
    order_response = await client.post(
        "/api/orders/",
        json={
            "platform": "AliExpress",
            "order_number_external": "TEST123",
            "order_date": "2026-02-14",
            "protection_end_date": "2026-03-14",
            "price_original": 100.0,
            "currency_original": "USD",
            "exchange_rate_frozen": 1.0,
            "price_final_base": 100.0,
            "is_price_estimated": False,
            "comment": "Test order"
        },
        headers=auth_headers
    )
    assert order_response.status_code == 201
    order_id = order_response.json()["id"]
    
    # Create an order item
    response = await client.post(
        "/api/order-items/",
        json={
            "order_id": order_id,
            "parcel_id": None,
            "item_name": "Test Item",
            "image_url": None,
            "tags": ["test", "electronics"],
            "quantity_ordered": 2,
            "quantity_received": 0,
            "item_status": "Waiting_Shipment"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["item_name"] == "Test Item"
    assert data["order_id"] == order_id
    assert data["quantity_ordered"] == 2
    assert len(data["tags"]) == 2


@pytest.mark.asyncio
async def test_create_order_item_unauthorized(client: AsyncClient, auth_headers: dict):
    """Test creating an order item for another user's order fails."""
    # Create another user
    register_response = await client.post(
        "/api/auth/register",
        json={
            "email": "otheruser@example.com",
            "password": "testpass123",
            "main_currency": "RUB"
        }
    )
    assert register_response.status_code == 201
    
    # Login as the other user
    login_response = await client.post(
        "/api/auth/login",
        data={"username": "otheruser@example.com", "password": "testpass123"}
    )
    other_token = login_response.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}
    
    # Create an order as the other user
    order_response = await client.post(
        "/api/orders/",
        json={
            "platform": "AliExpress",
            "order_number_external": "OTHER123",
            "order_date": "2026-02-14",
            "protection_end_date": "2026-03-14",
            "price_original": 50.0,
            "currency_original": "USD",
            "exchange_rate_frozen": 1.0,
            "price_final_base": 50.0,
            "is_price_estimated": False,
            "comment": "Other order"
        },
        headers=other_headers
    )
    other_order_id = order_response.json()["id"]
    
    # Try to create an item for the other user's order (using first user's auth)
    response = await client.post(
        "/api/order-items/",
        json={
            "order_id": other_order_id,
            "parcel_id": None,
            "item_name": "Unauthorized Item",
            "tags": [],
            "quantity_ordered": 1,
            "quantity_received": 0,
            "item_status": "Waiting_Shipment"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_order_item(client: AsyncClient, auth_headers: dict):
    """Test updating an order item."""
    # Create order and item
    order_response = await client.post(
        "/api/orders/",
        json={
            "platform": "AliExpress",
            "order_number_external": "UPDATE123",
            "order_date": "2026-02-14",
            "protection_end_date": "2026-03-14",
            "price_original": 100.0,
            "currency_original": "USD",
            "exchange_rate_frozen": 1.0,
            "price_final_base": 100.0,
            "is_price_estimated": False
        },
        headers=auth_headers
    )
    order_id = order_response.json()["id"]
    
    item_response = await client.post(
        "/api/order-items/",
        json={
            "order_id": order_id,
            "item_name": "Old Name",
            "tags": ["old"],
            "quantity_ordered": 1,
            "quantity_received": 0,
            "item_status": "Waiting_Shipment"
        },
        headers=auth_headers
    )
    item_id = item_response.json()["id"]
    
    # Update the item
    response = await client.put(
        f"/api/order-items/{item_id}",
        json={
            "item_name": "New Name",
            "tags": ["new", "updated"],
            "quantity_received": 1,
            "item_status": "Received"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["item_name"] == "New Name"
    assert data["quantity_received"] == 1
    assert data["item_status"] == "Received"
    assert "new" in data["tags"]


@pytest.mark.asyncio
async def test_delete_order_item(client: AsyncClient, auth_headers: dict):
    """Test deleting an order item."""
    # Create order and item
    order_response = await client.post(
        "/api/orders/",
        json={
            "platform": "AliExpress",
            "order_number_external": "DELETE123",
            "order_date": "2026-02-14",
            "price_original": 100.0,
            "currency_original": "USD",
            "exchange_rate_frozen": 1.0,
            "price_final_base": 100.0,
            "is_price_estimated": False
        },
        headers=auth_headers
    )
    order_id = order_response.json()["id"]
    
    item_response = await client.post(
        "/api/order-items/",
        json={
            "order_id": order_id,
            "item_name": "To Delete",
            "tags": [],
            "quantity_ordered": 1,
            "quantity_received": 0,
            "item_status": "Waiting_Shipment"
        },
        headers=auth_headers
    )
    item_id = item_response.json()["id"]
    
    # Delete the item
    response = await client.delete(
        f"/api/order-items/{item_id}",
        headers=auth_headers
    )
    
    assert response.status_code == 204
    
    # Verify it's deleted
    get_response = await client.get(
        f"/api/order-items/{item_id}",
        headers=auth_headers
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_link_item_to_parcel(client: AsyncClient, auth_headers: dict):
    """Test linking an order item to a parcel."""
    # Create order, parcel, and item
    order_response = await client.post(
        "/api/orders/",
        json={
            "platform": "AliExpress",
            "order_number_external": "LINK123",
            "order_date": "2026-02-14",
            "price_original": 100.0,
            "currency_original": "USD",
            "exchange_rate_frozen": 1.0,
            "price_final_base": 100.0,
            "is_price_estimated": False
        },
        headers=auth_headers
    )
    order_id = order_response.json()["id"]
    
    parcel_response = await client.post(
        "/api/parcels/",
        json={
            "tracking_number": "TRACK123",
            "carrier_slug": "usps",
            "status": "In_Transit"
        },
        headers=auth_headers
    )
    parcel_id = parcel_response.json()["id"]
    
    item_response = await client.post(
        "/api/order-items/",
        json={
            "order_id": order_id,
            "item_name": "Item to Link",
            "tags": [],
            "quantity_ordered": 1,
            "quantity_received": 0,
            "item_status": "Shipped"
        },
        headers=auth_headers
    )
    item_id = item_response.json()["id"]
    
    # Link item to parcel
    response = await client.put(
        f"/api/order-items/{item_id}",
        json={"parcel_id": parcel_id},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["parcel_id"] == parcel_id
