# Phase A2 proofs — NL policy intake

**Date:** 2026-09-12  
**Slug:** `phase-a2-nl-policy-intake`  
**Audit pass:** sticky propose + spot enrich + form ready + band gate

## Plan vs implementation

| Plan Done-when | Implementation | Audit fix |
|----------------|----------------|-----------|
| NL → `policy_draft` + questions/suggestions | `intake.ts` + `policy_draft` SSE | Spot fallback via `enrichDraftFromSpot` if LLM omits band |
| Chat answers or form → `ready` | Form + multi-turn messages | Form calls `withDraftStatus` on edit; chat follow-ups use **sticky propose** + history in classifier |
| Confirm → propose HITL; no x402 | `POST /agent/propose` → `proposeGuardianPolicy` | Validates amount **and** band (`draftIsReady`); dropped self-edge |
| Addon optional | Checkbox on card | unchanged |
| Proofs A9–A12 | this file | unit smoke below |

## Code deliverables

| Piece | Path | Status |
|-------|------|--------|
| Phase doc | `docs/phases/phase-a2-nl-policy-intake.md` | yes |
| Draft types + parse + enrich | `packages/keeper/src/agent/policyDraft.ts` | yes |
| Intake (Pyth + LLM JSON) | `packages/keeper/src/agent/intake.ts` | yes |
| Sticky propose + history classify | `packages/keeper/src/agent/composer.ts` | yes |
| Confirm HITL | `packages/keeper/src/agent/proposeConfirm.ts` | yes |
| Orch propose → intake | `packages/keeper/src/agent/orchestrate.ts` | yes |
| `POST /agent/propose` | `packages/keeper/src/index.ts` | yes |
| SSE `policy_draft` | keeper + web `agentEvents.ts` | yes |
| Multi-turn history | `packages/web/src/hooks/useAgentRun.ts` | yes |
| PolicyDraftCard (panel tokens) | `packages/web/src/components/PolicyDraftCard.tsx` | yes |

## A9 — parse / draft contract

`parsePolicyDraft` → `need_input` when amount empty; `enrichDraftFromSpot(3200)` fills ~5% stop; amount + stop → `ready`.

## A10 — route protect → propose

Composer maps protect / stop → `propose`. Open intake + “2 eth” → sticky `propose` without re-classifying as `full`/`risk`. Intent switch (“messari risk”) clears sticky.

## A11 — no hardcoded STOP_LOSS amount 0

Intake builds draft from Pyth + conversation JSON.

## A12 — Confirm path

`POST /agent/propose` requires `draftIsReady` → `proposeGuardianPolicy` only. No `postPaidTrigger`.

## Manual UI smoke

1. `NEXT_PUBLIC_KEEPER_URL=http://127.0.0.1:3001` + restart web + keeper.
2. “Protect my ETH if it dumps — draft a stop-loss I can clear-sign.”
3. Expect: `pipeline=propose`, `getPythSpot`, `policy_draft`, form (status may be `ready` if amount+band filled from LLM/spot).
4. If amount missing: reply “2 eth” → sticky propose → updated draft.
5. Confirm → `proposeGuardianPolicy`; no x402.

## Out of scope (plan “when useful”)

- Deep-link to LedgerConsole — not required for Done-when.

## Done-when

| Criterion | Status |
|-----------|--------|
| NL → policy_draft + questions/suggestions | yes (+ spot enrich) |
| Form or chat → ready → confirm HITL | yes (sticky + withDraftStatus) |
| No x402 on propose | yes |
| Addon optional | yes |
| Proof file | this file |
