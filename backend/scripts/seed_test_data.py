"""
Seed test data for BM Smart Parcel Tracker.

Creates a test user account and various parcels/orders/items to test all features:
- Lost parcels (old tracking updates)
- Action required (protection deadline soon, incomplete items)
- Various tags for filtering
- Different statuses
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta, UTC

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.order import Order
from app.models.parcel import Parcel
from app.models.order_item import OrderItem
from app.models.enums import MainCurrency, ParcelStatus, OrderItemStatus


async def create_test_user(session: AsyncSession) -> User:
    """Create or get test user."""
    from sqlalchemy import select
    
    # Check if user already exists
    result = await session.execute(
        select(User).where(User.email == "test@example.com")
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        print("[OK] Test user already exists: test@example.com")
        return existing_user
    
    # Create new test user
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        main_currency=MainCurrency.RUB
    )
    session.add(user)
    await session.flush()
    print("[OK] Created test user: test@example.com / testpass123")
    return user


async def create_test_data(session: AsyncSession, user: User):
    """Create test orders, parcels, and items."""
    
    today = datetime.now(UTC)
    
    # ============ Scenario 1: Normal delivery in progress ============
    order1 = Order(
        user_id=user.id,
        platform="AliExpress",
        order_number_external="AE20260201001",
        order_date=today - timedelta(days=15),
        protection_end_date=today + timedelta(days=45),
        price_original=2500.0,
        currency_original="RUB",
        exchange_rate_frozen=1.0,
        price_final_base=2500.0,
        is_price_estimated=False,
        comment="Первый тестовый заказ"
    )
    session.add(order1)
    await session.flush()
    
    parcel1 = Parcel(
        user_id=user.id,
        tracking_number="LP123456789CN",
        carrier_slug="china-post",
        status=ParcelStatus.In_Transit,
        tracking_updated_at=today - timedelta(days=2),
        weight_kg=0.5
    )
    session.add(parcel1)
    await session.flush()
    
    item1_1 = OrderItem(
        order_id=order1.id,
        parcel_id=parcel1.id,
        item_name="Беспроводные наушники TWS",
        image_url="https://example.com/headphones.jpg",
        tags=["electronics", "audio"],
        quantity_ordered=1,
        quantity_received=0,
        item_status=OrderItemStatus.Shipped
    )
    
    item1_2 = OrderItem(
        order_id=order1.id,
        parcel_id=parcel1.id,
        item_name="Чехол для телефона",
        tags=["accessories", "phone"],
        quantity_ordered=2,
        quantity_received=0,
        item_status=OrderItemStatus.Shipped
    )
    session.add_all([item1_1, item1_2])
    
    # ============ Scenario 2: Lost parcel (>30 days no update) ============
    order2 = Order(
        user_id=user.id,
        platform="AliExpress",
        order_number_external="AE20260101002",
        order_date=today - timedelta(days=60),
        protection_end_date=today + timedelta(days=15),
        price_original=1200.0,
        currency_original="RUB",
        exchange_rate_frozen=1.0,
        price_final_base=1200.0,
        is_price_estimated=False,
        comment="Потеряшка - давно нет обновлений"
    )
    session.add(order2)
    await session.flush()
    
    parcel2 = Parcel(
        user_id=user.id,
        tracking_number="RB987654321CN",
        carrier_slug="china-post",
        status=ParcelStatus.In_Transit,
        tracking_updated_at=today - timedelta(days=45),  # 45 days old!
        weight_kg=0.3
    )
    session.add(parcel2)
    await session.flush()
    
    item2_1 = OrderItem(
        order_id=order2.id,
        parcel_id=parcel2.id,
        item_name="USB кабель Type-C",
        tags=["electronics", "cables"],
        quantity_ordered=3,
        quantity_received=0,
        item_status=OrderItemStatus.Shipped
    )
    session.add(item2_1)
    
    # ============ Scenario 3: Action required - protection ending soon ============
    order3 = Order(
        user_id=user.id,
        platform="Ozon",
        order_number_external="OZON-2026-003",
        order_date=today - timedelta(days=55),
        protection_end_date=today + timedelta(days=3),  # 3 days left!
        price_original=3500.0,
        currency_original="RUB",
        exchange_rate_frozen=1.0,
        price_final_base=3500.0,
        is_price_estimated=False,
        comment="Срочно! Защита заканчивается"
    )
    session.add(order3)
    await session.flush()
    
    parcel3 = Parcel(
        user_id=user.id,
        tracking_number="OZON123456789",
        carrier_slug="ozon",
        status=ParcelStatus.In_Transit,
        tracking_updated_at=today - timedelta(days=5),
        weight_kg=1.2
    )
    session.add(parcel3)
    await session.flush()
    
    item3_1 = OrderItem(
        order_id=order3.id,
        parcel_id=parcel3.id,
        item_name="Смарт-часы",
        tags=["electronics", "watches", "gift"],
        quantity_ordered=1,
        quantity_received=0,
        item_status=OrderItemStatus.Shipped
    )
    session.add(item3_1)
    
    # ============ Scenario 4: Delivered but incomplete ============
    order4 = Order(
        user_id=user.id,
        platform="AliExpress",
        order_number_external="AE20260115004",
        order_date=today - timedelta(days=30),
        protection_end_date=today + timedelta(days=30),
        price_original=4200.0,
        currency_original="RUB",
        exchange_rate_frozen=1.0,
        price_final_base=4200.0,
        is_price_estimated=False,
        comment="Получен не полностью"
    )
    session.add(order4)
    await session.flush()
    
    parcel4 = Parcel(
        user_id=user.id,
        tracking_number="CP123456789RU",
        carrier_slug="russian-post",
        status=ParcelStatus.Delivered,
        tracking_updated_at=today - timedelta(days=2),
        weight_kg=0.8
    )
    session.add(parcel4)
    await session.flush()
    
    item4_1 = OrderItem(
        order_id=order4.id,
        parcel_id=parcel4.id,
        item_name="Футболка (размер M)",
        tags=["clothing", "apparel"],
        quantity_ordered=3,
        quantity_received=2,  # Only 2 of 3 received!
        item_status=OrderItemStatus.Dispute_Open
    )
    
    item4_2 = OrderItem(
        order_id=order4.id,
        parcel_id=parcel4.id,
        item_name="Носки",
        tags=["clothing", "apparel"],
        quantity_ordered=5,
        quantity_received=5,
        item_status=OrderItemStatus.Received
    )
    session.add_all([item4_1, item4_2])
    
    # ============ Scenario 5: Pickup ready ============
    order5 = Order(
        user_id=user.id,
        platform="Wildberries",
        order_number_external="WB-2026-005",
        order_date=today - timedelta(days=7),
        protection_end_date=today + timedelta(days=53),
        price_original=1800.0,
        currency_original="RUB",
        exchange_rate_frozen=1.0,
        price_final_base=1800.0,
        is_price_estimated=False,
        comment="Готов к получению"
    )
    session.add(order5)
    await session.flush()
    
    parcel5 = Parcel(
        user_id=user.id,
        tracking_number="WB98765432101",
        carrier_slug="wildberries",
        status=ParcelStatus.PickUp_Ready,
        tracking_updated_at=today,
        weight_kg=0.6
    )
    session.add(parcel5)
    await session.flush()
    
    item5_1 = OrderItem(
        order_id=order5.id,
        parcel_id=parcel5.id,
        item_name="Книга по программированию",
        tags=["books", "education"],
        quantity_ordered=1,
        quantity_received=0,
        item_status=OrderItemStatus.Shipped
    )
    session.add(item5_1)
    
    # ============ Scenario 6: USD order with currency conversion ============
    order6 = Order(
        user_id=user.id,
        platform="Amazon",
        order_number_external="AMZ-112-7654321",
        order_date=today - timedelta(days=25),
        protection_end_date=today + timedelta(days=35),
        price_original=50.0,
        currency_original="USD",
        exchange_rate_frozen=92.5,
        price_final_base=4625.0,
        is_price_estimated=True,
        comment="Заказ в долларах"
    )
    session.add(order6)
    await session.flush()
    
    parcel6 = Parcel(
        user_id=user.id,
        tracking_number="1Z999AA1234567890",
        carrier_slug="ups",
        status=ParcelStatus.In_Transit,
        tracking_updated_at=today - timedelta(days=10),
        weight_kg=1.5
    )
    session.add(parcel6)
    await session.flush()
    
    item6_1 = OrderItem(
        order_id=order6.id,
        parcel_id=parcel6.id,
        item_name="Механическая клавиатура",
        tags=["electronics", "pc-accessories", "gaming"],
        quantity_ordered=1,
        quantity_received=0,
        item_status=OrderItemStatus.Shipped
    )
    session.add(item6_1)
    
    # ============ Scenario 7: Multiple items, various statuses ============
    order7 = Order(
        user_id=user.id,
        platform="AliExpress",
        order_number_external="AE20260120007",
        order_date=today - timedelta(days=20),
        protection_end_date=today + timedelta(days=40),
        price_original=5600.0,
        currency_original="RUB",
        exchange_rate_frozen=1.0,
        price_final_base=5600.0,
        is_price_estimated=False,
        comment="Большой заказ с подарками"
    )
    session.add(order7)
    await session.flush()
    
    parcel7 = Parcel(
        user_id=user.id,
        tracking_number="LY123456789CN",
        carrier_slug="china-ems",
        status=ParcelStatus.In_Transit,
        tracking_updated_at=today - timedelta(days=1),
        weight_kg=2.1
    )
    session.add(parcel7)
    await session.flush()
    
    items7 = [
        OrderItem(
            order_id=order7.id,
            parcel_id=parcel7.id,
            item_name="LED гирлянда",
            tags=["home", "decoration", "gift"],
            quantity_ordered=2,
            quantity_received=0,
            item_status=OrderItemStatus.Shipped
        ),
        OrderItem(
            order_id=order7.id,
            parcel_id=parcel7.id,
            item_name="Кружка термос",
            tags=["home", "kitchenware", "gift"],
            quantity_ordered=1,
            quantity_received=0,
            item_status=OrderItemStatus.Shipped
        ),
        OrderItem(
            order_id=order7.id,
            parcel_id=parcel7.id,
            item_name="Набор отверток",
            tags=["tools", "hardware"],
            quantity_ordered=1,
            quantity_received=0,
            item_status=OrderItemStatus.Shipped
        ),
    ]
    session.add_all(items7)
    
    print(f"[OK] Created 7 test orders with {sum([2, 1, 1, 2, 1, 1, 3])} items across 7 parcels")


async def main():
    """Main function to seed test data."""
    print("=" * 60)
    print("BM Smart Parcel Tracker - Test Data Seeder")
    print("=" * 60)
    
    # Create async engine
    engine = create_async_engine(
        settings.database_url,
        echo=False
    )
    
    # Create async session factory
    async_session_factory = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session_factory() as session:
        try:
            # Create test user
            user = await create_test_user(session)
            
            # Create test data
            await create_test_data(session, user)
            
            # Commit all changes
            await session.commit()
            
            print("\n" + "=" * 60)
            print("SUCCESS: Test data created successfully!")
            print("=" * 60)
            print("\nTest Account:")
            print(f"  Email:    test@example.com")
            print(f"  Password: testpass123")
            print("\nTest Data Summary:")
            print("  - 7 orders (various platforms)")
            print("  - 7 parcels (different statuses)")
            print("  - 11 order items (various tags)")
            print("\nScenarios included:")
            print("  [OK] Normal delivery in progress")
            print("  [OK] Lost parcel (>30 days no tracking update)")
            print("  [OK] Action required (protection ending in 3 days)")
            print("  [OK] Delivered but incomplete (quantity mismatch)")
            print("  [OK] Pickup ready")
            print("  [OK] USD order with currency conversion")
            print("  [OK] Large order with multiple items")
            print("\nYou can now:")
            print("  1. Login at http://localhost:5173/login")
            print("  2. Test filters (Lost, Action Required, By Tag)")
            print("  3. Export CSV")
            print("=" * 60)
            
        except Exception as e:
            await session.rollback()
            print(f"\n[ERROR] Error creating test data: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
