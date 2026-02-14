"""FastAPI application entry. BM Smart Parcel Tracker."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.orders import router as orders_router
from app.api.parcels import router as parcels_router
from app.api.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


_origins = settings.BACKEND_CORS_ORIGINS or [
    "http://localhost:5173",
    "http://localhost:3000",
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders_router, prefix="/api/orders", tags=["orders"])
app.include_router(parcels_router, prefix="/api/parcels", tags=["parcels"])
app.include_router(users_router, prefix="/api/users", tags=["users"])


@app.get("/health")
def health():
    return {"status": "ok"}
