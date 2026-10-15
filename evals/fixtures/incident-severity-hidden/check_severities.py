"""Grader: severities.json must map every incident id to its SEV level per the Acme policy."""
import json
import sys

EXPECTED = {
    "INC-101": "SEV1",  # >= 50% of customers
    "INC-102": "SEV4",  # internal only
    "INC-103": "SEV2",  # >= 10% of customers
    "INC-104": "SEV1",  # data loss
    "INC-105": "SEV2",  # >= 60 minutes
    "INC-106": "SEV3",  # customer-facing, below SEV2 thresholds
    "INC-107": "SEV2",  # 45% is below the SEV1 threshold
    "INC-108": "SEV4",  # internal only
}

try:
    with open("severities.json") as fh:
        actual = {k: str(v).strip().upper().replace(" ", "") for k, v in json.load(fh).items()}
except (OSError, json.JSONDecodeError, AttributeError) as exc:
    sys.exit(f"severities.json missing or invalid: {exc}")

wrong = {k: (actual.get(k), v) for k, v in EXPECTED.items() if actual.get(k) != v}
if wrong:
    sys.exit("wrong (got, expected): " + json.dumps(wrong))
print("ok: all 8 incidents classified correctly")
