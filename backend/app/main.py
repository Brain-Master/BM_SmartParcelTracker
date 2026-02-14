"""FastAPI application entry. BM Smart Parcel Tracker."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.logging_config import setup_logging, get_logger
from app.api.auth import router as auth_router
from app.api.orders import router as orders_router
from app.api.parcels import router as parcels_router
from app.api.users import router as users_router
from app.api.order_items import router as order_items_router
from app.api.currency import router as currency_router
from app.api.parcel_items import router as parcel_items_router

# Configure logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Database initialization removed - use Alembic migrations instead
    # Run: alembic upgrade head
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(orders_router, prefix="/api/orders", tags=["orders"])
app.include_router(parcel_items_router, prefix="/api/parcels")
app.include_router(parcels_router, prefix="/api/parcels", tags=["parcels"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(order_items_router, prefix="/api/order-items", tags=["order-items"])
app.include_router(currency_router, prefix="/api/currency", tags=["currency"])


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors."""
    logger.warning(f"Validation error on {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": exc.errors()
        }
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database errors. Log full traceback for debugging."""
    logger.error("Database error on %s: %s", request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Database error occurred. Please try again later."
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors."""
    logger.error(f"Unexpected error on {request.url}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred. Please try again later."
        }
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
