# Phase D proofs — Hedera extras

**Date:** 2026-09-12 (gap patch pass)  
**Slug:** `phase-d-hedera-extras`  
**Public keeper:** `https://lga-keeper-production.up.railway.app`  
**Plan:** [docs/phases/phase-d-hedera-extras.md](../phases/phase-d-hedera-extras.md)

---

## Chosen

| Extra | Status | Evidence |
|---|---|---|
| HCS payment sink | **live** (trigger) | [phase-d-hcs.md](./phase-d-hcs.md) — `hcs://0.0.10423816/1` |
| Gated `/quote` | **live** | D2 unpaid 402 + paid 200 below |
| Light agent identity | **coded + unit smoke** | D3 — not live on Railway until redeploy |
| Graph ↔ Hedera | **coded; Studio empty** | D4 — schema/path real; `paymentAudits: []` until `PAYMENT_AUDIT_LOG` fires |

---

## Story

```text
Ledger  → clear-signs what may run
Graph   → policies + receipts + PaymentAudit (indexes Hedera refs when audit tx lands)
Hedera  → x402 settle + HCS memos that name which agent paid
```

---

## D1 — HCS (live)

Paid `/trigger` → `hcs://0.0.10423816/1`. Detail: [phase-d-hcs.md](./phase-d-hcs.md).

Working tree also memos `/quote`, stamps `agentId`, publishes roster (`ensureAgentRoster` / pin via `HCS_ROSTER_REF`).

---

## D2 — Gated `/quote` (live)

### Unpaid → 402

Re-checked 2026-09-12 (gap pass): `POST /quote` and `POST /trigger` both **402** on Railway.

Original capture 2026-09-12T15:50:18Z — `amount` `"10000"`, `resource` `/quote`, `hedera:testnet`.

### Paid → 200

| Field | Value |
|---|---|
| HTTP | **200** |
| `attemptId` | `att_mtykajje_jmelta` |
| Hedera settle | `0.0.7162784@1789228227.487248641` |
| `hcsRef` on **that** deploy | `null` (prod then memo’d HCS on `/trigger` only) |

Local tree memos HCS on both paths; prove after redeploy.

---

## D3 — Light agent identity

**Not full HCS-14 / ERC-8004.** Honor-system `x-lga-agent` from our consumers.

| Piece | Status |
|---|---|
| `agentIdentity.ts` | coded |
| `tagHederaPaymentRef` on **fill and no-fill** | coded |
| Payer / Autopilot / CLI headers | coded |
| Panel shows `agent {id}` | coded |
| `/health.hederaAgents` (`lastRosterRef`, `headerTrust`, `graphBridge`) | coded |
| Unit smoke | [phase-d/d3-identity-smoke.out.txt](./phase-d/d3-identity-smoke.out.txt) — **PASS true** |
| Live roster seq on Railway | **blocked** — prod `/health` has no `hederaAgents` ([railway-health-pre-d3.json](./phase-d/railway-health-pre-d3.json)) |

After deploy: boot log `agent roster hcs://…` (or set `HCS_ROSTER_REF` to pin), pay with CLI → body.`agentId=cli`.

---

## D4 — Graph ↔ Hedera

| Plane | Status |
|---|---|
| Code always calls `recordOnChainPaymentAudit` | coded |
| `/health.graphBridge.configured` | coded — false when `PAYMENT_AUDIT_LOG` unset |
| Studio `paymentAudits` | **empty** — [studio-payment-audits.json](./phase-d/studio-payment-audits.json) `{"data":{"paymentAudits":[]}}` |
| Clerk audits NL | coded — reads Studio; empty is honest |

Bridge is **inactive in prod** until ring/env has `PAYMENT_AUDIT_LOG=0x689ae72e…` and a paid settle succeeds the Base audit tx. HCS memos can still work without Graph indexing.

---

## Honesty / residual

1. `x-lga-agent` is not cryptographic attestation.  
2. Railway is pre–this-branch (no `hederaAgents` / no `capabilityBroker`).  
3. D3/D4 live captures require commit → redeploy → one `npm run pay` / `pay:quote` with audit log set.  
4. Pin roster after first publish: `HCS_ROSTER_REF=hcs://0.0.10423816/<seq>`.

---

## No regressions

| Check | Result |
|---|---|
| Unpaid `/trigger` | **402** (rechecked) |
| Unpaid `/quote` | **402** (rechecked) |
| `/health` `poll.mode` | `x402_only` |
| Autopilot | still `postPaidTrigger(…, { agentId: "autopilot" })` |

Primary host remains `/trigger` (Phase B).
