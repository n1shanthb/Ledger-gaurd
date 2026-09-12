# Phase D — Hedera extras (optional)

**Goal slug:** `phase-d-hedera-extras`  
**Depends on:** Phase B verified (hard). Prefer C1/C2 done.  
**Priority:** Lowest — track labels these **Extra points**. Never risk B/C for this.

## Objective

If time remains after A–C, add Hedera **extra-credit** items: verifiable **HCS** payment audit trail; optional second **x402-gated** metered endpoint (`/quote` or `/solve`); optional **HCS-14** (or light) agent identity for the six AgentIds. Skip Substreams unless A–C are solid and spare day exists.

## In scope (pick any; document which)

1. **HCS payment sink** — on settle / paid trigger, append memo or HCS message; Clerk can surface Hashscan link  
2. **Gated `/quote` or `/solve`** — pay-per-call risk/Messari gate; Payer or external agent pays; Blocky402  
3. **HCS-14 / agent identity** — light roster + `agentId` on payment memos (full ERC-8004 registry optional)  
4. **Graph ↔ Hedera** — every paid settle → Base `PaymentAudit` with `hcsRef` for Clerk / Studio

## Out of scope

- Replacing `/trigger` as primary host (B already qualifies)
- Substreams one-prompt (separate optional; only if this phase is green and time left)
- Reworking Phase A agent taxonomy

## Deliverables

| If chosen | Artifact |
|-----------|----------|
| HCS | Code + `docs/proofs/phase-d-hcs.md` with Hashscan URL |
| Gated solve | Route + unpaid 402 proof + paid call proof |
| Identity | Registry refs + README extras section |

## Proofs (per chosen item)

| Item | Proof |
|------|--------|
| HCS | Message id / Hashscan + link from payment in proof md |
| Gated solve | Unpaid 402 + paid response body |
| Identity | Public id strings + where registered |

## Done when

- At least one chosen extra has proof file **or** explicit `SKIPPED — time` note in `docs/proofs/phase-d.md` with reason.
- No regressions to unpaid `/trigger` 402 or Autopilot hot path.

## `/goal` prompt

```text
/goal Complete docs/phases/phase-d-hedera-extras.md for chosen extras (or document SKIPPED) with proofs in docs/proofs/phase-d.md
```
