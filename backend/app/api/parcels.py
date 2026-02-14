"""Parcels API. CRUD + tracking lookup placeholder."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_parcels():
    return []
