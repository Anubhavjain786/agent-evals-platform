from .orders import LineItem, calc_total


def render_invoice(customer: str, items: list[LineItem], tax_rate: float) -> str:
    lines = [f"Invoice for {customer}"]
    for item in items:
        lines.append(f"  {item.sku} x{item.quantity} @ {item.unit_cents / 100:.2f}")
    total = calc_total(items, tax_rate)
    lines.append(f"Total: {total / 100:.2f}")
    return "\n".join(lines)
