"""Tests for parcels endpoints."""
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
async def test_create_parcel(client: AsyncClient, test_user_data, test_parcel_data):
    """Test creating a parcel."""
    headers = await get_auth_headers(client, test_user_data)
    
    response = await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["tracking_number"] == test_parcel_data["tracking_number"]
    assert data["carrier_slug"] == test_parcel_data["carrier_slug"]
    assert "id" in data


@pytest.mark.asyncio
async def test_list_parcels(client: AsyncClient, test_user_data, test_parcel_data):
    """Test listing parcels."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create a parcel
    await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    
    # List parcels
    response = await client.get("/api/parcels/", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["tracking_number"] == test_parcel_data["tracking_number"]


@pytest.mark.asyncio
async def test_get_parcel(client: AsyncClient, test_user_data, test_parcel_data):
    """Test getting a specific parcel."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create a parcel
    create_response = await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    parcel_id = create_response.json()["id"]
    
    # Get the parcel
    response = await client.get(f"/api/parcels/{parcel_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == parcel_id


@pytest.mark.asyncio
async def test_update_parcel(client: AsyncClient, test_user_data, test_parcel_data):
    """Test updating a parcel."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create a parcel
    create_response = await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    parcel_id = create_response.json()["id"]
    
    # Update the parcel
    update_data = {"status": "Delivered"}
    response = await client.put(f"/api/parcels/{parcel_id}", json=update_data, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Delivered"


@pytest.mark.asyncio
async def test_delete_parcel(client: AsyncClient, test_user_data, test_parcel_data):
    """Test deleting a parcel."""
    headers = await get_auth_headers(client, test_user_data)
    
    # Create a parcel
    create_response = await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    parcel_id = create_response.json()["id"]
    
    # Delete the parcel
    response = await client.delete(f"/api/parcels/{parcel_id}", headers=headers)
    assert response.status_code == 204
    
    # Verify it's deleted
    get_response = await client.get(f"/api/parcels/{parcel_id}", headers=headers)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_list_parcels_unauthorized(client: AsyncClient):
    """Test listing parcels without authentication fails."""
    response = await client.get("/api/parcels/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_parcels_excludes_archived(client: AsyncClient, test_user_data, test_parcel_data):
    """By default list does not return archived parcels."""
    headers = await get_auth_headers(client, test_user_data)
    create_response = await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    parcel_id = create_response.json()["id"]
    await client.put(f"/api/parcels/{parcel_id}", json={"is_archived": True}, headers=headers)
    response = await client.get("/api/parcels/", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 0


@pytest.mark.asyncio
async def test_list_parcels_include_archived(client: AsyncClient, test_user_data, test_parcel_data):
    """With include_archived=true archived parcels are returned."""
    headers = await get_auth_headers(client, test_user_data)
    create_response = await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    parcel_id = create_response.json()["id"]
    await client.put(f"/api/parcels/{parcel_id}", json={"is_archived": True}, headers=headers)
    response = await client.get("/api/parcels/?include_archived=true", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["is_archived"] is True


@pytest.mark.asyncio
async def test_list_parcels_archived_only(client: AsyncClient, test_user_data, test_parcel_data):
    """With archived_only=true only archived parcels are returned."""
    headers = await get_auth_headers(client, test_user_data)
    r1 = await client.post("/api/parcels/", json=test_parcel_data, headers=headers)
    parcel_id_1 = r1.json()["id"]
    other = {**test_parcel_data, "tracking_number": "TRACK-OTHER-456"}
    r2 = await client.post("/api/parcels/", json=other, headers=headers)
    r2.json()["id"]
    await client.put(f"/api/parcels/{parcel_id_1}", json={"is_archived": True}, headers=headers)
    response = await client.get("/api/parcels/?include_archived=true&archived_only=true", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == parcel_id_1
    assert data[0]["is_archived"] is True
