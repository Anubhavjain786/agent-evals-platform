"""Grader: new_ids.txt must contain exactly the three valid ACME invoice IDs requested."""
import sys

def check_letter(digits: str) -> str:
    return chr(ord("A") + sum(int(d) for d in digits) * 7 % 26)

expected = {f"INV-2026-{n}-{check_letter(n)}" for n in ("00042", "00777", "31415")}
try:
    with open("new_ids.txt") as fh:
        actual = {line.strip() for line in fh if line.strip()}
except OSError as exc:
    sys.exit(f"new_ids.txt missing: {exc}")
if actual != expected:
    sys.exit(f"expected {sorted(expected)}, got {sorted(actual)}")
print("ok")
