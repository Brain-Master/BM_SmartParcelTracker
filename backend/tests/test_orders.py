"""Tests for orders endpoints."""
import pytest
from httpx import AsyncClient


async def get_auth_headers(client: AsyncClient, user_data: dict) -> dict:
    """Helper to register user and get auth headers."""
    await client.post("/api/auth/register", json=user_data)
    form_data = {
        "username": user_data["email"],
        "password": user_data["password"]
    }
    login_response = await client.post("/api/auth/login", data=form_data)
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_order(client: AsyncClient, test_user_data, test_order_data):
    """Test creating an order."""
    headers = await get_auth_headers(client, test_user_data)
    
    response = await client.post("/api/orders/", json=test_order_data, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["platform"] == test_order_data["platform"]
    assert data["order_number_external"] == test_order_data["order_number_external"]
    assert "id" in data


@pytest.mark.asyncio
async def test_list_orders(client: AsyncClient, test_user_data, test_order_data):
    """Test listing orders."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create an order
    await client.post("/api/orders/", json=test_order_data, headers=headers)
    
    # List orders
    response = await client.get("/api/orders/", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["platform"] == test_order_data["platform"]


@pytest.mark.asyncio
async def test_get_order(client: AsyncClient, test_user_data, test_order_data):
    """Test getting a specific order."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create an order
    create_response = await client.post("/api/orders/", json=test_order_data, headers=headers)
    order_id = create_response.json()["id"]
    
    # Get the order
    response = await client.get(f"/api/orders/{order_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == order_id


@pytest.mark.asyncio
async def test_update_order(client: AsyncClient, test_user_data, test_order_data):
    """Test updating an order."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create an order
    create_response = await client.post("/api/orders/", json=test_order_data, headers=headers)
    order_id = create_response.json()["id"]
    
    # Update the order
    update_data = {"comment": "Updated comment"}
    response = await client.put(f"/api/orders/{order_id}", json=update_data, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["comment"] == "Updated comment"


@pytest.mark.asyncio
async def test_delete_order(client: AsyncClient, test_user_data, test_order_data):
    """Test deleting an order."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create an order
    create_response = await client.post("/api/orders/", json=test_order_data, headers=headers)
    order_id = create_response.json()["id"]
    
    # Delete the order
    response = await client.delete(f"/api/orders/{order_id}", headers=headers)
    assert response.status_code == 204
    
    # Verify it's deleted
    get_response = await client.get(f"/api/orders/{order_id}", headers=headers)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_list_orders_unauthorized(client: AsyncClient):
    """Test listing orders without authentication fails."""
    response = await client.get("/api/orders/")
    assert response.status_code == 401
