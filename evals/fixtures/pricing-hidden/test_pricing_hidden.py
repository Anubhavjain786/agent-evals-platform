import unittest
from decimal import Decimal

from pricing import order_total, volume_discount


class HiddenPricingTest(unittest.TestCase):
    def test_tiers(self):
        self.assertEqual(volume_discount(0), Decimal("0"))
        self.assertEqual(volume_discount(49), Decimal("0.05"))
        self.assertEqual(volume_discount(99), Decimal("0.10"))
        self.assertEqual(volume_discount(250), Decimal("0.15"))

    def test_totals(self):
        self.assertEqual(order_total("3.33", 3), Decimal("9.99"))
        self.assertEqual(order_total("1.00", 100), Decimal("85.00"))
        self.assertEqual(order_total("19.99", 50), Decimal("899.55"))

    def test_coupon_after_discount(self):
        self.assertEqual(order_total("10.00", 10, "SAVE5"), Decimal("90.00"))
        self.assertEqual(order_total("1.00", 2, "SAVE5"), Decimal("0.00"))

    def test_rejects_negative_quantity(self):
        with self.assertRaises(ValueError):
            order_total("1.00", -1)


if __name__ == "__main__":
    unittest.main()
