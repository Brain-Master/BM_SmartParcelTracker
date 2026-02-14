"""Currency API endpoints."""
from datetime import datetime, UTC
from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_active_user
from app.models.user import User
from app.services import currency_service

router = APIRouter()


@router.get("/rate")
async def get_exchange_rate(
    from_currency: str = Query(..., description="Source currency code (USD, EUR, CNY, etc.)"),
    to_currency: str = Query(..., description="Target currency code (RUB, USD, EUR, etc.)"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current exchange rate from CBR API for preview before creating an order.
    
    Example: GET /api/currency/rate?from_currency=USD&to_currency=RUB
    Returns: {"from_currency": "USD", "to_currency": "RUB", "rate": 92.45, ...}
    """
    try:
        rate = await currency_service.get_exchange_rate(from_currency, to_currency)
        
        return {
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": rate,
            "source": "CBR",
            "timestamp": datetime.now(UTC).isoformat()
        }
    except ValueError as e:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch exchange rate: {str(e)}"
        )
