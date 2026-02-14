"""User endpoints."""
from fastapi import APIRouter, Depends

from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def get_current_user(current_user: User = Depends(get_current_active_user)):
    """Get current authenticated user."""
    return current_user
