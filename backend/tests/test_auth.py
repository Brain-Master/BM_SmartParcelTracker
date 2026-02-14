"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient, test_user_data):
    """Test user registration."""
    response = await client.post("/api/auth/register", json=test_user_data)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == test_user_data["email"]
    assert "id" in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, test_user_data):
    """Test registration with duplicate email fails."""
    # Create first user
    await client.post("/api/auth/register", json=test_user_data)
    
    # Try to create another user with same email
    response = await client.post("/api/auth/register", json=test_user_data)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user_data):
    """Test successful login."""
    # Register user
    await client.post("/api/auth/register", json=test_user_data)
    
    # Login
    form_data = {
        "username": test_user_data["email"],
        "password": test_user_data["password"]
    }
    response = await client.post("/api/auth/login", data=form_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user_data):
    """Test login with wrong password fails."""
    # Register user
    await client.post("/api/auth/register", json=test_user_data)
    
    # Try to login with wrong password
    form_data = {
        "username": test_user_data["email"],
        "password": "wrongpassword"
    }
    response = await client.post("/api/auth/login", data=form_data)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Test login with nonexistent user fails."""
    form_data = {
        "username": "nonexistent@example.com",
        "password": "password123"
    }
    response = await client.post("/api/auth/login", data=form_data)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient, test_user_data):
    """Test getting current user info."""
    # Register and login
    await client.post("/api/auth/register", json=test_user_data)
    form_data = {
        "username": test_user_data["email"],
        "password": test_user_data["password"]
    }
    login_response = await client.post("/api/auth/login", data=form_data)
    token = login_response.json()["access_token"]
    
    # Get current user
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/users/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user_data["email"]


@pytest.mark.asyncio
async def test_get_current_user_unauthorized(client: AsyncClient):
    """Test getting current user without token fails."""
    response = await client.get("/api/users/me")
    assert response.status_code == 401
