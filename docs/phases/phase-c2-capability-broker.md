# Phase C2 — Key Ring capability broker (Ledger named ask)

**Goal slug:** `phase-c2-capability-broker`  
**Depends on:** Phase A verified; C1 preferred first if time-boxed  
**Blocks:** none

## Objective

Evolve Key Ring from passive keystore to a **thin capability broker**: agents request scoped, time-boxed capabilities; **Solver / Composer never receive raw API keys or the Base session key**. Matches Ledger’s named ask: *“a broker hands out scoped capabilities, never the API key.”* Document headless VPS/CI enrollment as a demo beat.

## In scope

- Capability issuance layer over existing `wallet-cli ring` / `ring.ts` decrypt
- Example scopes: `pay:trigger` (TTL), `execute:policy:<id>`, `read:graph`, `read:pyth`
- Payer/Driver consume capabilities; Solver explain path cannot log or tool-return raw secrets
- Docs: enrollment on host with no USB; `/health` reflects broker/ring mode
- Proofs that tool outputs / SSE do not leak session key or OpenRouter key material

## Out of scope

- Replacing Ledger DMK / clear-sign (already Composer HITL)
- Full OAuth-style auth product
- HCS-14 identity (Phase D)
- Changing on-chain SessionKeyValidator

## Deliverables

| Artifact | Path / notes |
|----------|----------------|
| Broker module | e.g. `packages/keeper/src/capabilities.ts` or `ringBroker.ts` |
| Integration | `tools.ts`, `paidTrigger.ts`, `executor.ts`, agent ctx |
| Docs | `docs/LEDGER_DX_FEEDBACK.md` or `docs/proofs/phase-c2.md` + HACKATHON Ledger section |
| Demo script | Bare host → ring enroll → capability mint → pay/execute |

## Implementation checklist

1. Define capability type: `{ scope, expiresAt, token or handle }`.
2. Mint from Key Ring material server-side only; never put raw key in LLM messages / tool JSON.
3. Gate `postPaidTrigger` / `executePolicy` on valid capability (or internal mint for Autopilot/Payer only).
4. Solver tools: strip secrets from any ctx serialization.
5. Document headless enroll steps for judges.
6. Railway: note env-fallback honesty if ring decrypt unavailable — broker still must not expose raw keys to Solver.

## Proofs

| # | Proof | How |
|---|--------|-----|
| C2-1 | Broker exists | Module + call sites documented |
| C2-2 | No raw key in Solver path | Grep/logs: solver tool outs / SSE lack `0x` session key / `sk-or-` |
| C2-3 | Scoped pay | Payer uses capability; expired/missing scope fails closed |
| C2-4 | Headless enroll | Written steps + `/health.keyRing` (or broker) fields |
| C2-5 | Copy | “Key Ring holds keeper secrets”; master key never leaves Ledger |

## Done when

- C2-1–C2-5 in `docs/proofs/phase-c2.md`.
- Ledger prize one-liner is true in code, not only README.

## `/goal` prompt

```text
/goal Complete docs/phases/phase-c2-capability-broker.md to Done-when criteria with proofs in docs/proofs/phase-c2.md
```
