# Phase A proofs — core real multi-agent

**Date:** 2026-09-11  
**Slug:** `phase-a-core-multi-agent`  
**Keeper under test:** local `:3001` with Phase A code + Railway env inject (`LGA_SECRETS_SOURCE=env`, OpenRouter enrolled).  
**Artifacts:** `docs/proofs/phase-a/`

---

## A1 — Type wire

```text
rg "composer|autopilot|solver|payer|driver|clerk" packages/keeper/src/agent/types.ts packages/web/src/lib/agentEvents.ts
```

Both files define `AgentId` as the six ids. OpenRouter models are `composer` / `solver` / `clerk` only.

```text
rg '"coordinator"|"sentinel"|"oracle"|"broker"' packages/keeper/src/agent/types.ts packages/web/src/lib/agentEvents.ts
```

**Result:** no matches (no leftover AgentId literals).

---

## A2 — Non-LLM execute

`packages/keeper/src/agent/orchestrate.ts`:

- `needPayer = pipe === "execute"`
- `runPayer` calls `postPaidTrigger` directly with `model: "code:postPaidTrigger"`
- No `runSpecialistLoop` / broker LLM on execute

```text
rg "runSpecialistLoop" packages/keeper/src/agent/orchestrate.ts
```

**Result:** no matches.

Live SSE (A5): `agent_start` payer with `code:postPaidTrigger` — no broker model start.

---

## A3 — Code-first gate

`ensureSolverGate` runs `evaluateSwapGate` in-process **before** `runSolver` for risk/execute/propose/full.

A4 SSE order:

1. `tool_start` solver `evaluateSwapGate`
2. `gate` event
3. `tool_end` evaluateSwapGate
4. `agent_start` solver (explain LLM)

---

## A4 — Chat smoke (risk)

```bash
curl -sN -X POST http://127.0.0.1:3001/agent/run \
  -H "content-type: application/json" -H "accept: text/event-stream" \
  --data-binary @a4.json
```

Body: `protect eth tonight — check risk and swap gate`

**Capture:** [`phase-a/a4-risk.sse.txt`](./phase-a/a4-risk.sse.txt)

Highlights:

- `composer` → pipeline=`risk`
- `solver` + `evaluateSwapGate` + `gate` (`proceed:false`)
- Explain completed (~42s) — no ~90s Sonnet `tool_choice=required` abort
- `run_end` with Solver reply

---

## A5 — Execute smoke

Body: `execute now — pay x402 and trigger fill`

**Capture:** [`phase-a/a5-execute.sse.txt`](./phase-a/a5-execute.sse.txt)

Highlights:

- `gate` warn → edge `solver→payer` label `gate blocked`
- `payer` `agent_start` model `code:postPaidTrigger`
- Message: not calling `postPaidTrigger` (gate false) — no broker OpenRouter round
- `run_end` includes **Payer** block

---

## A6 — Pay-on-hit intact

Console (local start with Railway `PAY_ON_HIT=1`):

**Capture:** [`phase-a/a6-autopilot-console.txt`](./phase-a/a6-autopilot-console.txt)

```text
[lga] Autopilot pay-on-hit enabled (PAY_ON_HIT=1)
[lga] pay-on-hit Autopilot watch every 30000ms → http://127.0.0.1:3001
[lga] pay-on-hit Autopilot: no band hits
```

`POLL_MS=0` + `PAY_ON_HIT=1` unchanged; Autopilot/Driver tags on `payOnHit.ts` / `cycle.ts` / `executor.ts`. Hot path = `PAY_ON_HIT` noted in `packages/keeper/RAILWAY.md`.

---

## A7 — 3D six agents

`NODE_POS` + meshes for all six in `AgentOpsScene.tsx`; `deriveScene` roles:

```text
agents composer,clerk,solver,payer,autopilot,driver
count 6
titles Composer | Clerk | Market Solver | Payer | Autopilot | Driver
```

Docks (`graph`→clerk, `messari`→solver, `hedera`→payer, `ledger`→composer) pulse from real SSE `tool_start` / external live flags — no mock loops.

---

## A8 — Copy

Panel + console agent page:

- Composer / Clerk / Solver / Payer / Autopilot / Driver
- Preserved: “Master key never leaves Ledger”; “Key Ring holds keeper secrets”

Files: `KeeperAgentPanel.tsx`, `app/console/agent/page.tsx`.

---

## Health (local Phase A)

```json
{
  "openRouterModels": {
    "composer": "openai/gpt-4o-mini",
    "solver": "openai/gpt-4o-mini",
    "clerk": "openai/gpt-4o-mini"
  },
  "poll": { "ms": 0, "mode": "x402_only" }
}
```

Solver defaults to `gpt-4o-mini` via `OPENROUTER_MODEL_SOLVER` (does not inherit heavy `OPENROUTER_MODEL_ORACLE`). Explain path uses `forceToolsFirst: false`.

> Note: first A4/A5 smoke against this session still showed Railway’s old ORACLE→solver alias (`claude-sonnet-4`) before the ring default was tightened; SSE still completed with `solver` + `gate` and non-LLM `payer`.

---

## Done-when checklist

| Item | Status |
|------|--------|
| In-scope deliverables landed | yes |
| Proofs A1–A8 recorded | yes |
| No Phase B/C/D mixed | yes |

## Independent verify (follow-up)

See [`phase-a-verify.md`](./phase-a-verify.md) — audit found gaps (`full` payer, Driver SSE, Sonnet solver in SSE artifacts); code + Railway model vars fixed. **Redeploy before Phase B.**

