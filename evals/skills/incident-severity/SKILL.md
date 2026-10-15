---
name: incident-severity
description: Classify incidents into Acme severity levels (SEV1–SEV4) using the official policy thresholds.
version: 1.0.0
metadata:
  hermes:
    tags: [incident, operations, acme]
    category: operations
---

# Acme incident severity policy

## When to Use

Whenever you assign, review or report a severity (SEV level) for an incident.
Do not rely on general intuition: Acme's thresholds are specific.

## Procedure

Apply the rules top-down; the first rule that matches wins.

1. **SEV1** — any data loss, **or** customer-facing impact on **≥ 50%** of customers.
2. **SEV2** — customer-facing impact on **≥ 10%** of customers, **or** customer-facing
   impact lasting **≥ 60 minutes** (any share of customers).
3. **SEV3** — any other customer-facing impact.
4. **SEV4** — no customer-facing impact (internal systems, staging, delayed internal jobs).

## Pitfalls

- Data loss is SEV1 even when only a handful of records or customers are affected.
- 45% of customers is SEV2, not SEV1: the SEV1 threshold is 50%.
- Long internal-only incidents are still SEV4.

## Verification

Every incident gets exactly one level from SEV1–SEV4, written exactly in that form.
