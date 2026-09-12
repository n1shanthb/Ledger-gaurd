# Phase A — Core real multi-agent

**Goal slug:** `phase-a-core-multi-agent`  
**Depends on:** nothing  
**Blocks:** Phase B+

## Objective

Replace fake four-LLM tool-shards (Coordinator / Sentinel / Oracle / Broker) with trust-boundary agents: **composer**, **autopilot**, **solver**, **payer**, **driver**, **clerk**. Keep **LLM off** the price-band → fill hot path. Remap SSE + 3D Agent Ops UI to the six identities. Prove chat risk/execute paths and pay-on-hit still work.

## In scope

- Keeper agent rename + orchestrate rewrite
- Merge Sentinel+Oracle → Market Solver (code-first `evaluateSwapGate`)
- Non-LLM x402 Payer on `pipeline === "execute"`
- Tag existing pay-on-hit / cycle / executor as Autopilot / Driver
- Clerk owns status tools
- Web `AgentId` + `agentScene` + `AgentOpsScene` six-node viz
- Env model aliases (`OPENROUTER_MODEL_COORDINATOR` → composer, etc.)
- Panel / RAILWAY copy for new names

## Out of scope (later phases)

- x402 settle proof doc / unpaid curl evidence (Phase B)
- Subgraph MCP NL Clerk path (Phase C1)
- Key Ring capability broker (Phase C2)
- HCS / gated `/solve` / HCS-14 (Phase D)

## Deliverables (files)

| Area | Paths |
|------|--------|
| Types | `packages/keeper/src/agent/types.ts`, `packages/web/src/lib/agentEvents.ts` |
| Agents | `composer.ts` (was coordinator), `solver.ts`, `clerk.ts`; remove or gut `sentinel.ts` / `oracle.ts` / `broker.ts` LLM execute |
| Orch | `packages/keeper/src/agent/orchestrate.ts`, `chat.ts`, `openrouter.ts` as needed |
| Tools | `packages/keeper/src/agent/tools.ts`, `toolDefs.ts` |
| Hot path tags | `payOnHit.ts`, `cycle.ts`, `executor.ts`, `index.ts` `/trigger` logs |
| Ring models | `packages/keeper/src/ring.ts` — `composer` / `solver` / `clerk` + legacy env aliases |
| Web | `agentScene.ts`, `AgentOpsScene.tsx`, `KeeperAgentPanel.tsx` |
| Docs touch | `packages/keeper/RAILWAY.md` one-liner: hot path = `PAY_ON_HIT` |

## Implementation checklist

1. Change `AgentId` union to six ids on keeper + web (wire contract).
2. `runComposer` classify JSON (`status|risk|execute|propose|full`); propose HITL only.
3. `ensureSolverGate` always runs `evaluateSwapGate` in-process for risk/execute/full before explain LLM; default solver model `gpt-4o-mini`; no `forceToolsFirst` Sonnet loops.
4. Execute path: emit `payer` + call `postPaidTrigger` — **no** OpenRouter broker round.
5. Status path: `clerk` tools (`listActivePolicies`, `getRecentPayments`).
6. Tag Autopilot/Driver console (and SSE if trivial) on existing code paths.
7. Remap 3D meshes/edges/docks; event-driven only (no mock loops).
8. Fix TypeScript compile for keeper + web packages touched.

## Proofs (must capture before Done)

Record evidence under `docs/proofs/phase-a/` (create folder) or paste into a short `docs/proofs/phase-a.md`:

| # | Proof | How |
|---|--------|-----|
| A1 | Type wire | `rg "composer\|autopilot\|solver\|payer\|driver\|clerk" packages/keeper/src/agent/types.ts packages/web/src/lib/agentEvents.ts` — no leftover `coordinator\|sentinel\|oracle\|broker` as AgentId |
| A2 | Non-LLM execute | Code path: `orchestrate` execute branch calls `postPaidTrigger` without `runSpecialistLoop` / broker LLM |
| A3 | Code-first gate | `ensureSolverGate` / equivalent runs before solver explain for risk |
| A4 | Chat smoke | Local or Railway: `POST /agent/run` with “protect eth tonight” / risk — SSE shows `solver` + `gate`; completes without ~90s Sonnet abort |
| A5 | Execute smoke | With gate clear or override: SSE `payer` + attempt paid trigger (or blocked message if gate false) — no broker model start |
| A6 | Pay-on-hit intact | Logs still show `[lga] pay-on-hit` / Autopilot tag; `POLL_MS=0` + `PAY_ON_HIT=1` unchanged behavior |
| A7 | 3D | UI shows six agents; docks pulse on real tool events |
| A8 | Copy | Panel text uses Composer/Autopilot/Solver/Payer/Driver/Clerk; Ledger/Key Ring lines preserved |

## Done when

- All In-scope deliverables landed.
- Proofs A1–A8 recorded with commands/output or screenshots referenced in `docs/proofs/phase-a.md`.
- No Phase B/C/D work mixed into this PR/commit set.

## `/goal` prompt

```text
/goal Complete docs/phases/phase-a-core-multi-agent.md to Done-when criteria with proofs captured in docs/proofs/phase-a.md
```
