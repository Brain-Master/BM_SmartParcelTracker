"""Orders API. CRUD + currency logic placeholder."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_orders():
    return []
