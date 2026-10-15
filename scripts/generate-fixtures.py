#!/usr/bin/env python3
"""Generates the data fixtures for the sample suites deterministically.

The generated files are committed; this script documents how they were made
and prints the expected answers that the suite YAML files assert. Re-running
it reproduces byte-identical fixtures.

    python3 scripts/generate-fixtures.py
"""

from __future__ import annotations

import csv
import io
import json
import random
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "evals" / "fixtures"


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def sales_csv() -> None:
    rng = random.Random(7)
    regions = ["north", "south", "east", "west"]
    products = {"widget": 12.5, "gadget": 31.0, "gizmo": 7.25, "doohickey": 54.9}
    rows = []
    for month in range(5, 12):  # May–Nov 2025: Q3 must be filtered out of the noise.
        for _ in range(14):
            day = rng.randint(1, 28)
            region = rng.choice(regions)
            product = rng.choice(list(products))
            units = rng.randint(1, 40)
            rows.append((f"2025-{month:02d}-{day:02d}", region, product, units, products[product]))
    rows.sort()
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["date", "region", "product", "units", "unit_price"])
    writer.writerows(rows)
    write(ROOT / "csv-revenue" / "sales.csv", buf.getvalue())

    totals: dict[str, float] = defaultdict(float)
    for date, region, _product, units, price in rows:
        if "2025-07-01" <= date <= "2025-09-30":
            totals[region] += units * price
    expected = {r: round(totals[r], 2) for r in regions}
    print("csv-revenue Q3 totals:", json.dumps(expected), "top:", max(expected, key=expected.get))


def app_log() -> None:
    rng = random.Random(11)
    lines = []
    first_500_after_noon = None
    for i in range(2400):
        minute_of_day = 9 * 60 + i // 4  # 09:00 onwards, 4 lines per minute, strictly increasing
        hh, mm = divmod(minute_of_day, 60)
        ss = (i % 4) * 15 + rng.randint(0, 14)
        ts = f"2025-10-01T{hh:02d}:{mm:02d}:{ss:02d}Z"
        request_id = f"req-{rng.getrandbits(40):010x}"
        status = rng.choices([200, 201, 304, 404, 500, 503], weights=[70, 8, 8, 8, 3, 3])[0]
        path = rng.choice(["/api/orders", "/api/cart", "/api/users/me", "/healthz", "/api/checkout"])
        latency = rng.randint(3, 900)
        lines.append(f"{ts} level={'error' if status >= 500 else 'info'} request_id={request_id} method=GET path={path} status={status} latency_ms={latency}")
        if status == 500 and ts >= "2025-10-01T12:00:00Z" and first_500_after_noon is None:
            first_500_after_noon = request_id
    write(ROOT / "log-triage" / "app.log", "\n".join(lines) + "\n")
    print("log-triage first 500 after noon:", first_500_after_noon)


def shop_db() -> None:
    rng = random.Random(23)
    path = ROOT / "sql-churn" / "shop.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, signup_date TEXT NOT NULL);
        CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
                             order_date TEXT NOT NULL, amount_cents INTEGER NOT NULL);
        """
    )
    for cid in range(1, 151):
        conn.execute("INSERT INTO customers VALUES (?, ?, ?)", (cid, f"Customer {cid}", f"2024-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"))
    oid = 1
    for cid in range(1, 151):
        for _ in range(rng.randint(0, 6)):
            month = rng.randint(1, 8)
            conn.execute(
                "INSERT INTO orders VALUES (?, ?, ?, ?)",
                (oid, cid, f"2025-{month:02d}-{rng.randint(1, 28):02d}", rng.randint(500, 25000)),
            )
            oid += 1
    conn.commit()
    churned = conn.execute(
        """
        SELECT COUNT(*) FROM customers c
        WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.order_date BETWEEN '2025-01-01' AND '2025-03-31')
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.order_date BETWEEN '2025-04-01' AND '2025-06-30')
        """
    ).fetchone()[0]
    conn.execute("VACUUM")
    conn.close()
    print("sql-churn churned customers:", churned)


def users_csv() -> None:
    rng = random.Random(5)
    first = ["Ada", "Grace", "Linus", "Margaret", "Alan", "Barbara", "Dennis", "Frances", "Ken", "Radia"]
    last = ["Lovelace", "Hopper", "Torvalds", "Hamilton", "Turing", "Liskov", "Ritchie", "Allen", "Thompson", "Perlman"]
    rows = []
    for uid in rng.sample(range(100, 999), 24):
        f, l = rng.choice(first), rng.choice(last)
        email = f"{f}.{l}@Example.COM" if rng.random() > 0.2 else rng.choice([f"{f}.{l}-at-example.com", f"{f}@", "not-an-email"])
        active = rng.choice(["yes", "no", "Y", "N", "true", "false"])
        rows.append((uid, f"{f} {l}", email, active))
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["id", "name", "email", "active"])
    writer.writerows(rows)
    write(ROOT / "users-transform" / "users.csv", buf.getvalue())

    def valid(e: str) -> bool:
        local, _, domain = e.partition("@")
        return bool(local) and "." in domain and not domain.startswith(".")

    expected = sorted(
        (
            {"id": uid, "name": name, "email": email.lower(), "active": active.lower() in {"yes", "y", "true"}}
            for uid, name, email, active in rows
            if valid(email)
        ),
        key=lambda r: r["id"],
    )
    write(ROOT / "users-transform-hidden" / "expected_users.json", json.dumps(expected, indent=2) + "\n")
    print("users-transform valid rows:", len(expected))


def invoices() -> None:
    rng = random.Random(31)

    def check_letter(digits: str) -> str:
        return chr(ord("A") + sum(int(d) for d in digits) * 7 % 26)

    ids, valid = [], []
    for _ in range(30):
        digits = f"{rng.randint(0, 99999):05d}"
        year = rng.choice([2024, 2025])
        good = rng.random() < 0.5
        letter = check_letter(digits) if good else chr(ord("A") + (ord(check_letter(digits)) - ord("A") + rng.randint(1, 25)) % 26)
        invoice = f"INV-{year}-{digits}-{letter}"
        ids.append(invoice)
        if good:
            valid.append(invoice)
    write(ROOT / "invoice-ids" / "invoices.txt", "\n".join(ids) + "\n")
    write(ROOT / "invoice-ids-hidden" / "expected_valid.txt", "\n".join(sorted(valid)) + "\n")
    print("invoice-ids valid count:", len(valid))


if __name__ == "__main__":
    sales_csv()
    app_log()
    shop_db()
    users_csv()
    invoices()
