"""Tests for user endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_update_user_profile(client: AsyncClient, auth_headers: dict):
    """Test updating user profile."""
    # Update email and main_currency
    response = await client.put(
        "/api/users/me",
        json={
            "email": "updated@example.com",
            "main_currency": "USD"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "updated@example.com"
    assert data["main_currency"] == "USD"


@pytest.mark.asyncio
async def test_update_user_duplicate_email(client: AsyncClient, auth_headers: dict):
    """Test updating user with duplicate email fails."""
    # Create another user
    await client.post(
        "/api/auth/register",
        json={
            "email": "another@example.com",
            "password": "testpass123",
            "main_currency": "RUB"
        }
    )
    
    # Try to update current user to use that email
    response = await client.put(
        "/api/users/me",
        json={"email": "another@example.com"},
        headers=auth_headers
    )
    
    assert response.status_code == 409  # Conflict


@pytest.mark.asyncio
async def test_delete_user_account(client: AsyncClient, auth_headers: dict):
    """Test deleting user account."""
    # Delete account
    response = await client.delete(
        "/api/users/me",
        headers=auth_headers
    )
    
    assert response.status_code == 204
    
    # Try to access profile after deletion (should fail)
    response = await client.get(
        "/api/users/me",
        headers=auth_headers
    )
    
    assert response.status_code in [401, 404]  # Unauthorized or Not Found
