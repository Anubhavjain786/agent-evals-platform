import unittest

from slugify import slugify


class HiddenSlugifyTest(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(slugify("Hello, World!"), "hello-world")
        self.assertEqual(slugify("  Multiple   spaces -- and dashes  "), "multiple-spaces-and-dashes")

    def test_transliteration(self):
        self.assertEqual(slugify("Café Crème Brûlée"), "cafe-creme-brulee")
        self.assertEqual(slugify("Über naïve façade"), "uber-naive-facade")

    def test_symbols_and_digits(self):
        self.assertEqual(slugify("Top 10 C++ & Rust tips (2025)"), "top-10-c-rust-tips-2025")

    def test_empty(self):
        self.assertEqual(slugify("!!!"), "untitled")
        self.assertEqual(slugify(""), "untitled")

    def test_word_boundary_truncation(self):
        self.assertEqual(slugify("one two three four", max_length=12), "one-two")
        self.assertEqual(slugify("supercalifragilistic", max_length=5), "super")
        self.assertTrue(len(slugify("word " * 40)) <= 60)
        self.assertFalse(slugify("word " * 40).endswith("-"))


if __name__ == "__main__":
    unittest.main()
