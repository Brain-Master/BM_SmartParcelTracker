"""Pytest configuration and fixtures."""
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.core.config import settings

# Test database URL
TEST_DATABASE_URL = settings.database_url.replace("smart_parcel", "test_smart_parcel")

# Create test engine with NullPool to avoid connection issues
test_engine = create_async_engine(
    TEST_DATABASE_URL, 
    echo=False,
    poolclass=NullPool,  # Use NullPool for tests
)


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    TestSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()  # Rollback any pending transactions
    
    # Drop tables after test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database session override."""
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Test user data."""
    return {
        "email": "test@example.com",
        "password": "testpassword123",
        "main_currency": "RUB"
    }


@pytest.fixture
def test_order_data():
    """Test order data."""
    from datetime import datetime, timedelta, UTC
    return {
        "platform": "AliExpress",
        "order_number_external": "AE12345",
        "order_date": datetime.now(UTC).isoformat(),
        "protection_end_date": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
        "price_original": 100.50,
        "currency_original": "USD",
        "exchange_rate_frozen": 92.5,
        "price_final_base": 9296.25,
        "is_price_estimated": True,
        "comment": "Test order"
    }


@pytest.fixture
def test_parcel_data():
    """Test parcel data."""
    return {
        "tracking_number": "RR123456789CN",
        "carrier_slug": "russian-post",
        "status": "In_Transit",
        "weight_kg": 0.5
    }
