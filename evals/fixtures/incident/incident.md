# Incident 2025-09-18: checkout API errors

Raw timeline from the incident channel (times UTC).

- 14:02 PagerDuty: checkout-api 5xx rate above 20% in eu-west-1.
- 14:04 On-call (Priya) acknowledges. Dashboards show TLS handshake failures between checkout-api and payments-gateway.
- 14:09 Suspected bad deploy; checkout-api v3.18.2 rolled back to v3.18.1. No improvement.
- 14:15 Payments team confirms the gateway itself is healthy; their other clients are fine.
- 14:21 Found it: the mTLS client certificate checkout-api presents to the payments gateway expired at 14:00. Cert was issued manually a year ago; the renewal reminder went to a former employee's inbox.
- 14:33 New certificate issued and deployed to checkout-api pods.
- 14:41 Error rate back to baseline. About 6,200 checkout attempts failed during the incident; roughly 30% of customers retried successfully later.
- 14:49 Incident closed. Rollback to v3.18.1 reverted (v3.18.2 re-deployed) since the deploy was unrelated.

Notes:
- No data loss. Card details were never exposed.
- Other regions were unaffected (they use a different certificate with a later expiry).
