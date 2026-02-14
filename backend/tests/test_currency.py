"""Tests for currency service and endpoints."""
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock
from app.services import currency_service


# Mock CBR API response
MOCK_CBR_RESPONSE = {
    "Valute": {
        "USD": {"Value": 92.45, "Nominal": 1},
        "EUR": {"Value": 100.50, "Nominal": 1},
        "CNY": {"Value": 12.80, "Nominal": 1},
        "KZT": {"Value": 19.50, "Nominal": 100},  # Nominal != 1
    }
}


@pytest.mark.asyncio
async def test_get_exchange_rate_usd_to_rub():
    """Test USD to RUB conversion."""
    with patch('app.services.currency_service.httpx.AsyncClient') as MockAsyncClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=MOCK_CBR_RESPONSE)
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        MockAsyncClient.return_value = mock_client
        
        rate = await currency_service.get_exchange_rate("USD", "RUB")
        
        assert rate == 92.45


@pytest.mark.asyncio
async def test_get_exchange_rate_rub_to_usd():
    """Test RUB to USD conversion."""
    with patch('app.services.currency_service.httpx.AsyncClient') as MockAsyncClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=MOCK_CBR_RESPONSE)
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        MockAsyncClient.return_value = mock_client
        
        rate = await currency_service.get_exchange_rate("RUB", "USD")
        
        # Should be 1 / 92.45
        assert abs(rate - (1.0 / 92.45)) < 0.0001


@pytest.mark.asyncio
async def test_get_exchange_rate_cross_rate():
    """Test cross-rate conversion (USD to EUR)."""
    with patch('app.services.currency_service.httpx.AsyncClient') as MockAsyncClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=MOCK_CBR_RESPONSE)
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        MockAsyncClient.return_value = mock_client
        
        rate = await currency_service.get_exchange_rate("USD", "EUR")
        
        # USD to RUB = 92.45, EUR to RUB = 100.50
        # USD to EUR = 92.45 / 100.50
        expected = 92.45 / 100.50
        assert abs(rate - expected) < 0.0001


@pytest.mark.asyncio
async def test_get_exchange_rate_same_currency():
    """Test same currency returns 1.0."""
    rate = await currency_service.get_exchange_rate("RUB", "RUB")
    assert rate == 1.0


@pytest.mark.asyncio
async def test_get_exchange_rate_nominal_handling():
    """Test handling of Nominal != 1."""
    with patch('app.services.currency_service.httpx.AsyncClient') as MockAsyncClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=MOCK_CBR_RESPONSE)
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        MockAsyncClient.return_value = mock_client
        
        rate = await currency_service.get_exchange_rate("KZT", "RUB")
        
        # Value = 19.50 for 100 KZT, so 1 KZT = 19.50 / 100 = 0.195
        assert abs(rate - 0.195) < 0.0001


@pytest.mark.asyncio
async def test_get_exchange_rate_unknown_currency():
    """Test unknown currency raises ValueError."""
    with patch('app.services.currency_service.httpx.AsyncClient') as MockAsyncClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=MOCK_CBR_RESPONSE)
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        MockAsyncClient.return_value = mock_client
        
        with pytest.raises(ValueError, match="Currency XXX not found"):
            await currency_service.get_exchange_rate("XXX", "RUB")


@pytest.mark.asyncio
async def test_get_rate_endpoint(client: AsyncClient, auth_headers: dict):
    """Test GET /api/currency/rate endpoint."""
    with patch('app.services.currency_service.httpx.AsyncClient') as MockAsyncClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=MOCK_CBR_RESPONSE)
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        MockAsyncClient.return_value = mock_client
        
        response = await client.get(
            "/api/currency/rate?from_currency=USD&to_currency=RUB",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["from_currency"] == "USD"
        assert data["to_currency"] == "RUB"
        assert data["rate"] == 92.45
        assert data["source"] == "CBR"
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_create_order_auto_conversion(client: AsyncClient, auth_headers: dict):
    """Test creating order with automatic currency conversion."""
    with patch('app.services.currency_service.httpx.AsyncClient') as MockAsyncClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=MOCK_CBR_RESPONSE)
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        MockAsyncClient.return_value = mock_client
        
        # Clear currency cache
        await currency_service.clear_cache()
        
        # Create order in USD (should auto-convert to RUB)
        response = await client.post(
            "/api/orders/",
            json={
                "platform": "AliExpress",
                "order_number_external": "AUTO123",
                "order_date": "2026-02-14T00:00:00Z",
                "price_original": 25.99,
                "currency_original": "USD"
                # No exchange_rate_frozen or price_final_base provided
            },
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["currency_original"] == "USD"
        assert abs(float(data["exchange_rate_frozen"]) - 92.45) < 0.0001
        assert data["is_price_estimated"] is True
        # price_final_base should be 25.99 * 92.45
        expected_final = 25.99 * 92.45
        assert abs(float(data["price_final_base"]) - expected_final) < 0.01


@pytest.mark.asyncio
async def test_create_order_same_currency(client: AsyncClient, auth_headers: dict):
    """Test creating order with same currency (no conversion needed)."""
    response = await client.post(
        "/api/orders/",
        json={
            "platform": "Ozon",
            "order_number_external": "SAME123",
            "order_date": "2026-02-14T00:00:00Z",
            "price_original": 1500.0,
            "currency_original": "RUB"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["currency_original"] == "RUB"
    assert float(data["exchange_rate_frozen"]) == 1.0
    assert data["is_price_estimated"] is False
    assert float(data["price_final_base"]) == 1500.0


@pytest.mark.asyncio
async def test_create_order_manual_rate_override(client: AsyncClient, auth_headers: dict):
    """Test creating order with manual exchange rate override."""
    response = await client.post(
        "/api/orders/",
        json={
            "platform": "Amazon",
            "order_number_external": "MANUAL123",
            "order_date": "2026-02-14T00:00:00Z",
            "price_original": 50.0,
            "currency_original": "USD",
            "exchange_rate_frozen": 95.0,  # Manual override
            "price_final_base": 4750.0,
            "is_price_estimated": False
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert float(data["exchange_rate_frozen"]) == 95.0
    assert data["is_price_estimated"] is False
    assert float(data["price_final_base"]) == 4750.0
