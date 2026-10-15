from dataclasses import dataclass


@dataclass(frozen=True)
class LineItem:
    sku: str
    unit_cents: int
    quantity: int


def calc_total(items: list[LineItem], tax_rate: float = 0.0) -> int:
    """Order total in cents, tax included, rounded half up."""
    subtotal = sum(item.unit_cents * item.quantity for item in items)
    return int(subtotal * (1 + tax_rate) + 0.5)
