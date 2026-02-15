"""Currency exchange rate service using CBR API."""
import asyncio
import httpx
from datetime import datetime, timedelta, UTC
from typing import Dict, Tuple
from app.core.config import settings


# Simple in-memory cache: {(from_curr, to_curr): (rate, timestamp)}
_rate_cache: Dict[Tuple[str, str], Tuple[float, datetime]] = {}
_cache_ttl = timedelta(hours=1)
_cache_lock = asyncio.Lock()  # Protect cache from concurrent access


async def get_exchange_rate(
    from_currency: str,
    to_currency: str,
    date: str | None = None
) -> float:
    """
    Get exchange rate from CBR API.
    Returns rate such that: amount_to = amount_from * rate
    
    Example: get_exchange_rate("USD", "RUB") -> 92.45 (1 USD = 92.45 RUB)
    
    Args:
        from_currency: Source currency code (USD, EUR, CNY, etc.)
        to_currency: Target currency code (RUB, USD, EUR, etc.)
        date: Optional date in YYYY-MM-DD format (default: today)
    
    Returns:
        float: Exchange rate
    
    Raises:
        httpx.HTTPError: If API is unavailable
        ValueError: If currency not found
    """
    # Same currency = no conversion
    if from_currency == to_currency:
        return 1.0
    
    # Check cache first (ignore date for caching)
    cache_key = (from_currency, to_currency)
    async with _cache_lock:
        if cache_key in _rate_cache:
            rate, timestamp = _rate_cache[cache_key]
            if datetime.now(UTC) - timestamp < _cache_ttl:
                return rate
    
    # Fetch from CBR API
    async with httpx.AsyncClient(timeout=10.0) as client:
        url = settings.cbr_api_url  # https://www.cbr-xml-daily.ru/daily_json.js
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
    
    # CBR API format: {Valute: {USD: {Value: 92.45, Nominal: 1}, ...}}
    # Base currency is always RUB
    valutes = data.get("Valute", {})
    
    # Calculate rate
    if to_currency == "RUB":
        # Converting from foreign currency to RUB
        if from_currency not in valutes:
            raise ValueError(f"Currency {from_currency} not found in CBR data")
        
        valute_data = valutes[from_currency]
        value = valute_data["Value"]
        nominal = valute_data.get("Nominal", 1)
        rate = value / nominal
        
    elif from_currency == "RUB":
        # Converting from RUB to foreign currency
        if to_currency not in valutes:
            raise ValueError(f"Currency {to_currency} not found in CBR data")
        
        valute_data = valutes[to_currency]
        value = valute_data["Value"]
        nominal = valute_data.get("Nominal", 1)
        rate = nominal / value
        
    else:
        # Cross-rate (e.g. USD → EUR)
        if from_currency not in valutes or to_currency not in valutes:
            missing = from_currency if from_currency not in valutes else to_currency
            raise ValueError(f"Currency {missing} not found in CBR data")
        
        from_data = valutes[from_currency]
        to_data = valutes[to_currency]
        
        from_value = from_data["Value"] / from_data.get("Nominal", 1)
        to_value = to_data["Value"] / to_data.get("Nominal", 1)
        
        rate = from_value / to_value
    
    # Cache the result
    async with _cache_lock:
        _rate_cache[cache_key] = (rate, datetime.now(UTC))
    
    return rate


async def clear_cache():
    """Clear the exchange rate cache. Useful for testing."""
    async with _cache_lock:
        _rate_cache.clear()
