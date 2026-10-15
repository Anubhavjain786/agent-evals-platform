import unittest
from decimal import Decimal

from pricing import order_total, volume_discount


class VolumeDiscountTest(unittest.TestCase):
    def test_small_orders_have_no_discount(self):
        self.assertEqual(volume_discount(9), Decimal("0"))

    def test_tier_boundaries_are_inclusive(self):
        self.assertEqual(volume_discount(10), Decimal("0.05"))
        self.assertEqual(volume_discount(50), Decimal("0.10"))
        self.assertEqual(volume_discount(100), Decimal("0.15"))


class OrderTotalTest(unittest.TestCase):
    def test_no_discount(self):
        self.assertEqual(order_total("2.50", 4), Decimal("10.00"))

    def test_discount_reduces_total(self):
        self.assertEqual(order_total("10.00", 20), Decimal("190.00"))


if __name__ == "__main__":
    unittest.main()
