# Phase B — x402 host+consumer proof (Hedera P0)

**Goal slug:** `phase-b-x402-host-proof`  
**Depends on:** Phase A verified  
**Blocks:** Phase C+ (prize narrative); can start C1 in parallel only if `/trigger` already 402s in prod

## Objective

Prove LGA is **both** the hosted x402-gated service **and** the paying agent in the same repo: unpaid `POST /trigger` → real **402** via Blocky402; paid path settles and may execute. Document Start Fresh + Graph **Use Case** (agent/app, not tooling) + host/consumer diagram. Capture settle proof for judges.

## In scope

- Verify live Railway (or local) unpaid `/trigger` returns HTTP 402 with payment challenge
- Complete ≥1 paid request end-to-end (Payer / pay-on-hit / CLI pay)
- Write/update `docs/proofs/x402-settle.md` with timestamps, status codes, settle refs
- README + `docs/HACKATHON.md` + `docs/SUBGRAPH_MCP.md`: agent names from Phase A; **Start Fresh**; pitch as AI **Use Case** agent/app; diagram host=`/trigger`, consumer=`payer`
- Confirm `/health` still exposes Subgraph Studio / MCP target URL

## Out of scope

- HCS payment sink (Phase D)
- Second gated endpoint `/quote` or `/solve` (Phase D)
- Capability broker (Phase C2)
- MCP Clerk NL rewiring (Phase C1)
- Demo video recording (manual; note checklist only)

## Deliverables

| Artifact | Path |
|----------|------|
| Settle proof | `docs/proofs/x402-settle.md` |
| Phase B checklist log | `docs/proofs/phase-b.md` |
| Hackathon mapping | `docs/HACKATHON.md` (agent names + host/consumer) |
| MCP doc names | `docs/SUBGRAPH_MCP.md` |
| Keeper README payment flow | `packages/keeper/README.md` (if diagram still old names) |
| Root/README prize pitch | agent/app Use Case; Start Fresh |

## Implementation checklist

1. `curl -i -X POST https://<keeper>/trigger` (no payment) → expect **402**.
2. Paid path: existing `postPaidTrigger` / `npm run pay` / pay-on-hit — capture settle success.
3. Document Blocky402 facilitator + Hedera network (testnet) in proof.
4. Explicit README sentence: same process hosts gated `/trigger` and runs Payer consumer.
5. Explicit README: Graph track = **Use Case** (not tooling MCP product).
6. Explicit: submission pool **Start Fresh**.

## Proofs

| # | Proof | How |
|---|--------|-----|
| B1 | Unpaid 402 | Saved response headers/body snippet in `x402-settle.md` |
| B2 | Paid E2E | Settle tx / facilitator response / keeper log lines in proof file |
| B3 | Host+consumer | README section with both roles labeled |
| B4 | Start Fresh + Use Case | HACKATHON.md / README contain both phrases unambiguously |
| B5 | Health MCP URL | `/health` JSON includes Studio query URL |
| B6 | Hot path still non-LLM | Reconfirm pay-on-hit works without OpenRouter (spot check) |

## Done when

- B1–B6 recorded in `docs/proofs/phase-b.md` + `x402-settle.md`.
- Judges can follow README payment flow without guessing who hosts vs who pays.

## `/goal` prompt

```text
/goal Complete docs/phases/phase-b-x402-host-proof.md to Done-when criteria with proofs in docs/proofs/phase-b.md and docs/proofs/x402-settle.md
```
