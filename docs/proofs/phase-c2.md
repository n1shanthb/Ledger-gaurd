# Phase C2 proofs — Key Ring capability broker

**Date:** 2026-09-12 (revised honesty pass)  
**Slug:** `phase-c2-capability-broker`  
**Artifact:** `docs/proofs/phase-c2/c2-broker-smoke.out.txt`

---

## C2-1 — Broker exists

Module: `packages/keeper/src/capabilities.ts` (`mint` / `require` / `stampCapability` / `redactSecrets`)

| Call site | Use |
|-----------|-----|
| `paidTrigger.ts` | `pay:trigger` / `pay:quote` — require id **or** in-process stamp (`mintInternal`) |
| `executor.ts` | `execute:policy:<id>` — **`secrets` required**; cannot skip gate by omission |
| `cycle.ts` | stamps `read:graph` + `read:pyth`; execute via `mintInternal` |
| `tools.ts` | stamps `read:graph` / `read:pyth` on Graph/Pyth/Messari tools |
| `orchestrate.ts` `runPayer` | mints then `require` via `capabilityId` |
| `openrouter.ts` | `redactSecrets` before LLM/SSE |
| `index.ts` `/health` | `capabilityBroker` status |

---

## C2-2 — No raw key in Solver path

Smoke (`c2-broker-smoke.out.txt`):

```text
redact true key=[REDACTED_SESSION] or=[REDACTED_OPENROUTER]
```

Tool outs / agent messages pass through `redactSecrets` in `openrouter.ts`.

---

## C2-3 — Scoped pay (fail closed)

From smoke (unit, not Railway settle):

```text
expired fail-closed capability … expired for pay:trigger
missing fail-closed true capability required for pay:trigger …
PASS true
```

**Hot-path honesty:** `npm run pay` / pay-on-hit / default `postPaidTrigger` use **`mintInternal: true`** — a server stamp, not a separate agent capability RPC. Payer chat path mints then passes `capabilityId` with `mintInternal: false`.

---

## C2-4 — Headless enroll / broker mode

- **Enroll steps:** `docs/LEDGER_DX_FEEDBACK.md` § Capability broker demo (USB once → ring enroll → `WALLET_PASS` only).
- **Unit smoke:** `packages/keeper/scripts/c2-broker-smoke.mts` → `c2-broker-smoke.out.txt` (mint / stamp `read:*` / expire / redact / `status.mode=ring-broker`). Does **not** replace live `/health`.
- **Railway (captured 2026-09-12, pre-C2 deploy):** `docs/proofs/phase-c2/railway-health.json` — `keyRing.source=env`, `headless=false`, **no** `capabilityBroker` field yet (old build). After this branch deploys: expect `capabilityBroker.mode=env-broker` until ring-on-Railway.
- **Local ring `/health`:** run keeper with `LGA_SECRETS_SOURCE=ring` → expect `headless=true` + `capabilityBroker.mode=ring-broker` (not captured in this artifact while local keeper was down).

---

## C2-5 — Copy

| Phrase | Where |
|--------|--------|
| Key Ring holds keeper secrets | broker status, ringStatus, LEDGER_DX |
| Master key never leaves Ledger | agent prompts / DX |
| Broker hands out scopes, never raw API keys | fail-closed errors + DX |

---

## Limitations (intentional / called out)

1. Caps on Autopilot/`npm run pay` are **in-process stamps**, not an external capability mint API.
2. `read:graph` / `read:pyth` are stamped at tool/cycle entry (gated through broker), same stamp model.
3. C2-4 “live Railway headless” is **not** claimed by the smoke artifact alone.

---

## Done-when

| Item | Status |
|------|--------|
| C2-1–C2-5 recorded (honest) | yes |
| Ledger one-liner true in code | yes — Solver never gets raw keys; scopes stamped/required |
| Footguns addressed | `executePolicy` requires `secrets`; read scopes on tools |
