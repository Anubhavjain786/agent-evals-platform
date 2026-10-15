---
name: acme-invoice-ids
description: Validate, parse or generate ACME invoice IDs (format INV-YYYY-NNNNN-C with a check letter).
version: 1.0.0
metadata:
  hermes:
    tags: [finance, validation, acme]
    category: data
---

# ACME invoice IDs

## When to Use

Any time you need to check whether an ACME invoice ID is valid, extract its
parts, or create a new one. Format-only checks are NOT enough: the check
letter must be verified.

## Format

`INV-YYYY-NNNNN-C`

- `YYYY` — four-digit issue year
- `NNNNN` — exactly five digits (leading zeros allowed)
- `C` — one uppercase check letter

## Procedure

1. Match the ID against `^INV-\d{4}-\d{5}-[A-Z]$`. Anything else is invalid.
2. Sum the five digits of `NNNNN` → `s`.
3. Compute `k = (s * 7) % 26`.
4. The expected check letter is the `k`-th letter of the alphabet, zero-based
   (`0 → A`, `1 → B`, … `25 → Z`).
5. The ID is valid only if `C` equals the expected letter.

```python
import re

def is_valid_invoice_id(invoice_id: str) -> bool:
    m = re.fullmatch(r"INV-\d{4}-(\d{5})-([A-Z])", invoice_id.strip())
    if not m:
        return False
    digits, letter = m.groups()
    return letter == chr(ord("A") + sum(map(int, digits)) * 7 % 26)
```

## Pitfalls

- The year does not take part in the checksum.
- Check letters are case-sensitive; lowercase letters are invalid.

## Verification

`INV-2025-00001-H` is valid (1 × 7 = 7 → H). `INV-2025-00001-A` is not.
