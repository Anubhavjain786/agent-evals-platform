"""Grader: valid.txt must list exactly the valid invoice ids (order and blank lines ignored)."""
import sys

try:
    with open("valid.txt") as fh:
        actual = {line.strip() for line in fh if line.strip()}
except OSError as exc:
    sys.exit(f"valid.txt missing: {exc}")

with open("expected_valid.txt") as fh:
    expected = {line.strip() for line in fh if line.strip()}

missing, extra = sorted(expected - actual), sorted(actual - expected)
if missing or extra:
    sys.exit(f"missing: {missing}\nextra: {extra}")
print(f"ok: {len(expected)} valid invoice ids")
