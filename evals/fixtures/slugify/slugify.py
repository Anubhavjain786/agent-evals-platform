"""URL slugs for blog posts."""


def slugify(title: str, max_length: int = 60) -> str:
    """Turn a post title into a URL slug.

    Rules:
      * lowercase ASCII only: accented Latin letters are transliterated
        ("Café" -> "cafe"); any other non-alphanumeric character is a separator
      * words are joined by single hyphens; no leading or trailing hyphens
      * the slug is at most `max_length` characters and is cut at a word
        boundary (never in the middle of a word) unless the first word alone
        is longer than `max_length`, in which case it is truncated
      * an empty result becomes "untitled"

    >>> slugify("Hello, World!")
    'hello-world'
    """
    raise NotImplementedError
