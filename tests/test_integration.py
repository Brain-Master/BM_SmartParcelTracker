from decimal import Decimal
import sqlite3

import pytest

from app.export import export_order_items_csv
from app.models import Parcel
from app.tracking import refresh_parcel_status


class MockTrackingService:
    def __init__(self, statuses: list[str]):
        self._statuses = statuses

    def fetch_status(self, tracking_number: str) -> str:
        if not tracking_number:
            raise ValueError("tracking_number is required")
        return self._statuses.pop(0)


def test_fk_constraint_order_item_requires_existing_parcel(db_conn) -> None:
    with pytest.raises(sqlite3.IntegrityError):
        db_conn.execute(
            "INSERT INTO order_items(parcel_id, sku, quantity, unit_price_rub) VALUES (?, ?, ?, ?)",
            (999, "SKU-1", 1, "100.00"),
        )
        db_conn.commit()


def test_tracking_status_is_updated_from_external_service(db_conn) -> None:
    db_conn.execute("INSERT INTO parcels(tracking_number, status) VALUES (?, ?)", ("TRK-100", "created"))
    db_conn.commit()
    parcel_id = db_conn.execute("SELECT id FROM parcels WHERE tracking_number=?", ("TRK-100",)).fetchone()[0]

    parcel = Parcel(id=parcel_id, tracking_number="TRK-100", status="created")
    mock_service = MockTrackingService(["in_transit", "delivered"])

    assert refresh_parcel_status(parcel, mock_service) == "in_transit"
    assert refresh_parcel_status(parcel, mock_service) == "delivered"


def test_csv_export_total_matches_database_sum(db_conn) -> None:
    db_conn.execute("INSERT INTO parcels(tracking_number, status) VALUES (?, ?)", ("TRK-200", "created"))
    parcel_id = db_conn.execute("SELECT id FROM parcels WHERE tracking_number=?", ("TRK-200",)).fetchone()[0]
    db_conn.executemany(
        "INSERT INTO order_items(parcel_id, sku, quantity, unit_price_rub) VALUES (?, ?, ?, ?)",
        [
            (parcel_id, "SKU-A", 2, "50.00"),
            (parcel_id, "SKU-B", 1, "99.99"),
        ],
    )
    db_conn.commit()

    csv_data, total = export_order_items_csv(db_conn)

    assert "SKU-A" in csv_data
    assert "SKU-B" in csv_data
    assert total == Decimal("199.99")
