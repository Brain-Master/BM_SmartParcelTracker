from decimal import Decimal, ROUND_HALF_UP


TWOPLACES = Decimal("0.01")


def convert_to_rub(amount: Decimal, exchange_rate: Decimal) -> Decimal:
    """Convert any currency amount to RUB using HALF_UP rounding.

    Keeps sign for negative values and supports zero amounts.
    """
    converted = amount * exchange_rate
    return converted.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
