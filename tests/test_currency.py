from decimal import Decimal

from app.currency import convert_to_rub


def test_convert_to_rub_zero_amount() -> None:
    assert convert_to_rub(Decimal("0"), Decimal("91.1234")) == Decimal("0.00")


def test_convert_to_rub_negative_amount() -> None:
    assert convert_to_rub(Decimal("-15.50"), Decimal("90")) == Decimal("-1395.00")


def test_convert_to_rub_rounding_half_up() -> None:
    assert convert_to_rub(Decimal("1"), Decimal("12.345")) == Decimal("12.35")
