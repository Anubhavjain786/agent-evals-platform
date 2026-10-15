import subprocess
import sys
import unittest

from shop import orders
from shop.invoice import render_invoice
from shop.orders import LineItem, compute_order_total


class HiddenRenameTest(unittest.TestCase):
    def test_new_name_behaves_like_old(self):
        items = [LineItem("A", 333, 3)]
        self.assertEqual(compute_order_total(items), 999)
        self.assertEqual(compute_order_total(items, 0.1), 1099)

    def test_old_name_is_gone(self):
        self.assertFalse(hasattr(orders, "calc_total"))

    def test_call_sites_still_work(self):
        self.assertIn("Total: 10.89", render_invoice("Bo", [LineItem("A", 990, 1)], 0.1))
        out = subprocess.run([sys.executable, "-m", "shop.cli", "A:250:2"], capture_output=True, text=True, check=True)
        self.assertEqual(out.stdout.strip(), "500")


if __name__ == "__main__":
    unittest.main()
