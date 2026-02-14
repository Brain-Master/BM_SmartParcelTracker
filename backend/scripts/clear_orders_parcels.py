"""
Clear all orders, parcels, order_items, and parcel_items from the database.

Use this to start fresh with empty orders/parcels data.
Users are preserved.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


async def main() -> None:
    """Truncate orders, parcels, order_items, parcel_items tables."""
    print("=" * 60)
    print("BM Smart Parcel Tracker - Clear Orders & Parcels")
    print("=" * 60)

    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        try:
            # TRUNCATE in correct order (parcel_items, order_items, parcels, orders)
            await session.execute(
                text(
                    "TRUNCATE TABLE parcel_items, order_items, parcels, orders "
                    "RESTART IDENTITY CASCADE"
                )
            )
            await session.commit()
            print("\n[OK] All orders, parcels, order_items, and parcel_items cleared.")
            print("     Users preserved.")
            print("\n" + "=" * 60)
        except Exception as e:
            await session.rollback()
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
