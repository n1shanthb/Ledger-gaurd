# Phase A — independent verification (post-proof audit)

**Date:** 2026-09-11  
**Auditor:** code review against `docs/phases/phase-a-core-multi-agent.md` + `docs/proofs/phase-a.md` (did not trust write-up alone).

## Verdict

**Phase A core is real** (six AgentIds, code-first gate, non-LLM payer, Autopilot tags, 3D six nodes, copy).  
**Not clean enough to rubber-stamp** — several gaps found; fixes applied below before Phase B.

| Proof claim | Independent result |
|-------------|-------------------|
| A1 Type wire | **PASS** — `types.ts` + `agentEvents.ts` six ids; no old AgentId literals |
| A2 Non-LLM execute | **PASS** — `runPayer` → `postPaidTrigger`; no `runSpecialistLoop` in orchestrate |
| A3 Code-first gate | **PASS** — `ensureSolverGate` before `runSolver`; SSE order matches |
| A4 Chat smoke | **PASS with caveat** — artifact valid, but solver model was **Sonnet** (`claude-sonnet-4`), not mini |
| A5 Execute smoke | **PASS** — payer `code:postPaidTrigger`, gate blocked path; no broker LLM |
| A6 Pay-on-hit | **PASS** — Autopilot strings in `payOnHit.ts` / `cycle.ts` / index; console capture OK |
| A7 3D | **PASS** — `NODE_POS` six agents + meshes; docks mapped |
| A8 Copy | **PASS** — panel + console agent page |

## Gaps found (pre-fix)

1. **`full` never called Payer** — plan said execute|full; code had `needPayer = pipe === "execute"` only. Vague “protect + act” pipelines skipped pay.
2. **Self-edge `composer→composer` on propose** — useless for viz; ledger dock already pulses via `proposeGuardianPolicy` tool.
3. **Driver never in chat SSE** — only console `[lga] Driver executePolicy`; 3D Driver stayed idle on execute runs.
4. **Solver still Sonnet in A4/A5 SSE** — Railway had no `OPENROUTER_MODEL_SOLVER`; proofs note claimed mini fix, but captured SSE still shows Sonnet (stale session and/or pre-fix binary). Legacy `OPENROUTER_MODEL` / `OPENROUTER_MODEL_ORACLE` still Sonnet on Railway.
5. **Deprecated stubs remain** — `oracle.ts` / `broker.ts` / `sentinel.ts` / `coordinator.ts` throw or re-export (OK, not loaded by orch).
6. **`requestExecutionAttempt` still in toolDefs** — not on any allowlist (dead); fine for now.
7. **Messari gate often `proceed:false`** (Compound util / WETH depth) — blocks chat pay unless override; Autopilot hot path unaffected. Demo tip: say “override” or raise util floor later — not a Phase A blocker.

## Fixes applied this audit

| Fix | File |
|-----|------|
| `needPayer` includes `full` | `packages/keeper/src/agent/orchestrate.ts` |
| Remove propose self-edge | same |
| Emit `payer→driver` SSE after pay attempt | same |
| `[lga] Driver /trigger paid cycle starting` | `packages/keeper/src/index.ts` |
| Set Railway `OPENROUTER_MODEL_{COMPOSER,SOLVER,CLERK}=openai/gpt-4o-mini` | Railway vars (`--skip-deploys`) |

**Required before relying on prod:** redeploy keeper so code + model vars load. Confirm `/health.openRouterModels.solver === openai/gpt-4o-mini`.

## Still OK / no change

- Autopilot = deterministic pay-on-hit (LLM off hot path) — confirmed.
- Clerk `forceToolsFirst: true` with mini — acceptable for status.
- Phase B/C/D not mixed into proofs folder beyond this verify note.

## Phase B gate

After **redeploy** and health check shows mini for solver:

1. Proceed to `docs/phases/phase-b-x402-host-proof.md`.
2. Re-smoke one risk SSE if you want a clean A4 artifact (optional).
