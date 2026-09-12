# Phase A2 — NL policy intake (Composer)

**Goal slug:** `phase-a2-nl-policy-intake`  
**Depends on:** Phase A core (six agents)  
**Blocks:** none hard; do before Phase B for demo quality

## Objective

Intent Composer turns natural-language protection / exit goals into interactive **policy intake**: clarifying questions, suggested defaults (slippage, bands from Pyth), optional add-on policies, then HITL `proposeGuardianPolicy` for Ledger clear-sign. No hardcoded example scripts.

## In scope

- Route protect/exit language → `propose` pipeline
- `intake.ts` composer loop + `policy_draft` SSE
- `POST /agent/propose` confirm path
- Multi-turn chat history + PolicyDraftCard UI
- Proofs A9–A12 in `docs/proofs/phase-a2.md`

## Out of scope

- Broadcast without Ledger HITL
- LLM on Autopilot fill path
- Phase B x402 proofs

## Done when

1. “Protect my ETH …” → `policy_draft` with questions + suggestions (not empty STOP_LOSS).
2. Chat answers or form edits → draft `ready`.
3. Confirm → propose HITL SSE; no x402.
4. Addon optional, not forced.
5. `docs/proofs/phase-a2.md` recorded.

## `/goal` prompt

```text
/goal Complete docs/phases/phase-a2-nl-policy-intake.md to Done-when criteria with proofs in docs/proofs/phase-a2.md
```
