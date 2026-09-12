# Phase B proofs — x402 host+consumer

**Date:** 2026-09-12  
**Slug:** `phase-b-x402-host-proof`  
**Public keeper:** `https://lga-keeper-production.up.railway.app`  
**Settle detail:** [x402-settle.md](./x402-settle.md)

---

## B1 — Unpaid 402

```bash
curl -i -X POST https://lga-keeper-production.up.railway.app/trigger \
  -H "content-type: application/json" -d "{}"
```

**Result:** `HTTP/1.1 402 Payment Required` + Blocky402 `payment-required` header (`hedera:testnet`, amount `100000`, payTo `0.0.8011510`).

Full headers/body: [x402-settle.md § Unpaid](./x402-settle.md).

---

## B2 — Paid E2E

```bash
WALLET_PASS=… LGA_SECRETS_SOURCE=ring \
  KEEPER_URL=https://lga-keeper-production.up.railway.app/trigger \
  npm run pay
```

**Result:** HTTP **200**, `attemptId=att_mty5ow0x_78bqpa`, settle tx `0.0.7162784@1789203702.106539865`, `payment-response.success=true`, network `hedera:testnet`.

No Base fill (`evaluated:0`) — settle still proves paid host consumption. HashScan + HCS refs in [x402-settle.md § Paid](./x402-settle.md).

---

## B3 — Host + consumer

`packages/keeper/README.md` section **Host + consumer (same process)**:

- **HOST** = gated `POST /trigger`
- **CONSUMER** = Payer / Autopilot / `npm run pay`

Root `README.md` architecture block labels the same.

---

## B4 — Start Fresh + Use Case

| Phrase | Where |
|--------|--------|
| **Start Fresh** | root `README.md`, `docs/HACKATHON.md`, `packages/keeper/README.md` |
| AI **Use Case** agent/app (not tooling) | root README, keeper README, `docs/SUBGRAPH_MCP.md` demo pitch, HACKATHON Graph section |

---

## B5 — Health MCP / Studio URL

```bash
curl -s https://lga-keeper-production.up.railway.app/health
```

```json
{
  "ok": true,
  "mcp": "Subgraph MCP → https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4 — …",
  "poll": { "ms": 0, "mode": "x402_only" },
  "network": "hedera:testnet"
}
```

Studio query URL present in `mcp` field.

---

## B6 — Hot path still non-LLM

Spot check `packages/keeper/src/payOnHit.ts`:

- Imports `findHitPolicies` + `postPaidTrigger` only — **no** OpenRouter / agent imports
- Logs: `[lga] pay-on-hit Autopilot …` (Phase A proof still valid)
- `POLL_MS=0` + `PAY_ON_HIT=1` is prize Autopilot path; chat LLM is off the band→fill path

---

## Done-when

| Item | Status |
|------|--------|
| B1–B6 recorded | yes |
| `x402-settle.md` filled | yes |
| Judges can follow host vs pay from README | yes |
| No Phase C/D mixed | yes (HCS only as settle side-effect already in product) |
