import unittest

from shop.invoice import render_invoice
from shop.orders import LineItem, calc_total


class ShopTest(unittest.TestCase):
    def test_total(self):
        items = [LineItem("A", 250, 2), LineItem("B", 1000, 1)]
        self.assertEqual(calc_total(items), 1500)
        self.assertEqual(calc_total(items, 0.08), 1620)

    def test_invoice(self):
        text = render_invoice("Ada", [LineItem("A", 199, 3)], 0.0)
        self.assertIn("Total: 5.97", text)


if __name__ == "__main__":
    unittest.main()
