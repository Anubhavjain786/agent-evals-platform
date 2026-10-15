import sys

from . import orders


def main(argv: list[str]) -> int:
    """Usage: python -m shop.cli SKU:CENTS:QTY [...]"""
    items = []
    for arg in argv:
        sku, cents, qty = arg.split(":")
        items.append(orders.LineItem(sku, int(cents), int(qty)))
    print(orders.calc_total(items))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
