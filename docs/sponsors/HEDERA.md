# Sponsor brief — Hedera

**Track:** AI & Agentic Payments on Hedera (x402 + Blocky402).

---

## Claim

Hedera meters every keeper **execution attempt**. The same process **hosts** an x402-gated `POST /trigger` (and cheaper `POST /quote`) and **consumes** it as Payer / Autopilot / `npm run pay` — paying HBAR via Blocky402 on `hedera:testnet`. Settle is independent of Base fills: payment unlocks evaluation; Graph + Pyth + on-chain bands decide whether Driver broadcasts. Optional **HCS** memos attach a HashScan-auditable ref (`hcsRef`) to paid attempts.

Without Hedera/x402, prize-mode keeper (`POLL_MS=0`) has no paid gate — free autopoll would violate the “pay to attempt” product.

---

## What breaks without it

If x402 / Blocky402 were removed:

- `POST /trigger` would be a free remote execute endpoint. Anyone who can reach the keeper could burn session-key gas / attempt fills without a Hedera economic gate.
- The **host + consumer in one process** story collapses — Payer and Autopilot would call an ungated cycle.
- HCS payment audit refs (`hcs://…`) and HashScan settle links disappear from compliance narratives that Graph `PaymentAudit` is meant to join.

Base policy signatures and Graph indexing still matter, but the **agentic payment** track requirement fails: there is no live 402 → settle → attempt loop.

---

## Where it's implemented

| Path | Role |
|---|---|
| [`packages/keeper/src/x402.ts`](../../packages/keeper/src/x402.ts) | Express x402 middleware config — `/trigger` + `/quote` prices |
| [`packages/keeper/src/index.ts`](../../packages/keeper/src/index.ts) | Host routes; `handlePaidCycle`; HCS memo after settle |
| [`packages/keeper/src/paidTrigger.ts`](../../packages/keeper/src/paidTrigger.ts) | Consumer: `@x402/fetch` + Hedera exact scheme; capability gate |
| [`packages/keeper/src/pay.ts`](../../packages/keeper/src/pay.ts) | CLI `npm run pay` / `pay:quote` |
| [`packages/keeper/src/payOnHit.ts`](../../packages/keeper/src/payOnHit.ts) | Autopilot: pay only when near/in band |
| [`packages/keeper/src/hcsAudit.ts`](../../packages/keeper/src/hcsAudit.ts) | `submitHcsMemo` + HashScan topic URL helper |
| [`packages/keeper/src/payments.ts`](../../packages/keeper/src/payments.ts) | In-process payment attempt buffer / jsonl |
| [`packages/keeper/src/paymentAuditTx.ts`](../../packages/keeper/src/paymentAuditTx.ts) | Optional Base `PaymentAuditLog` bridge |
| [`packages/keeper/README.md`](../../packages/keeper/README.md) | Host+consumer architecture for judges |

Public host: `https://lga-keeper-production.up.railway.app`

---

## Proof artifacts

### 1 — Unpaid `/trigger` → HTTP 402

Full capture: [`docs/proofs/x402-settle.md`](../proofs/x402-settle.md) § Unpaid  

```bash
curl -i -X POST https://lga-keeper-production.up.railway.app/trigger \
  -H "content-type: application/json" -d "{}"
```

**Result:** `HTTP/1.1 402 Payment Required` + `payment-required` header (Blocky402 accepts: `hedera:testnet`, amount `100000`, payTo `0.0.8011510`).

Also summarized in [`docs/proofs/phase-b.md`](../proofs/phase-b.md).

### 2 — Paid settle (Blocky402) + HashScan

| Field | Value |
|---|---|
| Attempt | `att_mty5ow0x_78bqpa` |
| HTTP | **200** |
| Settle tx | `0.0.7162784@1789203702.106539865` |
| HashScan | https://hashscan.io/testnet/transaction/0.0.7162784%401789203702.106539865 |
| Payer account | `0.0.10364129` |
| Network | `hedera:testnet` |
| Base fill that run | none (`evaluated:0`) — payment ≠ fill |

Detail: [`docs/proofs/x402-settle.md`](../proofs/x402-settle.md) § Paid.

![HashScan x402 settle](../assets/x402-hashscan.png)
<!-- REPLACE: full HashScan testnet transaction page for the settle id above -->

### 3 — HCS payment audit topic

| Field | Value |
|---|---|
| Ref | `hcs://0.0.10423816/1` |
| Topic | https://hashscan.io/testnet/topic/0.0.10423816 |
| Write-up | [`docs/proofs/phase-d-hcs.md`](../proofs/phase-d-hcs.md) |
| Phase D summary | [`docs/proofs/phase-d.md`](../proofs/phase-d.md) |

Code: [`hcsAudit.ts`](../../packages/keeper/src/hcsAudit.ts) called from [`index.ts`](../../packages/keeper/src/index.ts) after paid cycle.

### 4 — Gated `/quote` (extra metered endpoint)

Unpaid 402 + paid 200 (`att_mtykajje_jmelta`, settle `0.0.7162784@1789228227.487248641`): [`docs/proofs/phase-d.md`](../proofs/phase-d.md) § D2.

```bash
curl -i -X POST https://lga-keeper-production.up.railway.app/quote \
  -H "content-type: application/json" -d "{}"
# 402, amount 10000

WALLET_PASS=… LGA_SECRETS_SOURCE=ring \
  KEEPER_URL=https://lga-keeper-production.up.railway.app \
  npm run pay:quote
```

### 5 — Prize mode health

[`docs/proofs/phase-c2/railway-health.json`](../proofs/phase-c2/railway-health.json):

```json
"poll": { "ms": 0, "mode": "x402_only" },
"network": "hedera:testnet"
```

[PROOF NEEDED: fresh `/payments/recent` JSON from Railway after a paid run if the in-memory buffer was reset across deploys]

---

## Track alignment

| Requirement (name) | How we satisfy it |
|---|---|
| **Live x402-gated service** | Unpaid `/trigger` → 402 — proof #1 |
| Settled through **Blocky402** | Facilitator in settle flow — proof #2 |
| Platform/agent **consumes** ≥1 real paid request | `npm run pay` / Payer / Autopilot — proof #2 |
| Public README with payment architecture | [`packages/keeper/README.md`](../../packages/keeper/README.md) |
| Demo video ≤ 5 min | [PROOF NEEDED: link to demo video showing 402 → pay → settle] |

Extras:

| Extra | Status |
|---|---|
| Verifiable payment audit (HCS) | Proof #3 |
| Second metered endpoint `/quote` | Proof #4 |
| Full HCS-14 / ERC-8004 agent DIDs | **Not claimed** — light roster / `x-lga-agent` tags only ([`phase-d.md`](../proofs/phase-d.md) SKIP notes) |

Satisfies: **“live x402-gated service on Hedera testnet”** — proof #1.  
Satisfies: **“≥1 real paid request end-to-end”** — proof #2.

---

## Honest limitations

1. **Payment ≠ fill** — proven paid runs often return `evaluated:0` / empty `executed` when no policy is in band. Do not imply every HashScan settle produces a Basescan fill.
2. **Testnet HBAR** — demo network is `hedera:testnet`; mainnet path is documented as optional, not the captured proof.

