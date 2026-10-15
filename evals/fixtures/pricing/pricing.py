"""Order pricing for the Acme shop."""

from decimal import ROUND_HALF_UP, Decimal

# Volume discount tiers: (minimum quantity, discount rate). Checked from the largest tier down.
TIERS = [(100, Decimal("0.15")), (50, Decimal("0.10")), (10, Decimal("0.05"))]


def volume_discount(quantity: int) -> Decimal:
    """Discount rate for an order of `quantity` units."""
    for minimum, rate in TIERS:
        if quantity > minimum:
            return rate
    return Decimal("0")


def order_total(unit_price: str, quantity: int, coupon: str | None = None) -> Decimal:
    """Total in dollars, rounded to cents.

    The volume discount applies first; a coupon "SAVE5" then takes $5 off,
    but never makes the total negative.
    """
    if quantity < 0:
        raise ValueError("quantity must be non-negative")
    subtotal = Decimal(unit_price) * quantity
    total = subtotal * volume_discount(quantity)
    if coupon == "SAVE5":
        total = total - Decimal("5")
    return max(total, Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
