"""Grader: users.json must equal the expected transformation exactly."""
import json
import sys

try:
    with open("users.json") as fh:
        actual = json.load(fh)
except (OSError, json.JSONDecodeError) as exc:
    sys.exit(f"users.json missing or invalid: {exc}")

with open("expected_users.json") as fh:
    expected = json.load(fh)

if actual != expected:
    exp_ids = [r["id"] for r in expected]
    act_ids = [r.get("id") for r in actual] if isinstance(actual, list) else actual
    sys.exit(f"mismatch\nexpected ids: {exp_ids}\nactual ids:   {act_ids}")
print(f"ok: {len(expected)} users")
