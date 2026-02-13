from dataclasses import dataclass
import sqlite3


@dataclass(slots=True)
class Parcel:
    id: int
    tracking_number: str
    status: str


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS parcels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tracking_number TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'created'
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parcel_id INTEGER NOT NULL,
            sku TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price_rub NUMERIC NOT NULL,
            FOREIGN KEY(parcel_id) REFERENCES parcels(id)
        );
        """
    )
