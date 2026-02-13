from decimal import Decimal
from io import StringIO
import csv
import sqlite3


def export_order_items_csv(conn: sqlite3.Connection) -> tuple[str, Decimal]:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["sku", "quantity", "unit_price_rub", "line_total"])
    writer.writeheader()

    total = Decimal("0")
    rows = conn.execute("SELECT sku, quantity, unit_price_rub FROM order_items").fetchall()
    for sku, quantity, unit_price_rub in rows:
        price = Decimal(str(unit_price_rub))
        line_total = Decimal(quantity) * price
        total += line_total
        writer.writerow(
            {
                "sku": sku,
                "quantity": quantity,
                "unit_price_rub": f"{price:.2f}",
                "line_total": f"{line_total:.2f}",
            }
        )

    db_total_raw = conn.execute("SELECT SUM(quantity * unit_price_rub) FROM order_items").fetchone()[0]
    db_total = Decimal(str(db_total_raw if db_total_raw is not None else 0)).quantize(Decimal("0.01"))
    if total.quantize(Decimal("0.01")) != db_total:
        raise AssertionError("CSV total does not match DB aggregate")

    return output.getvalue(), total.quantize(Decimal("0.01"))
