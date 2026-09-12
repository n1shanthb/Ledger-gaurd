# LGA Keeper

Headless agent: Receipt Graph → Pyth → **x402-gated** `POST /trigger` → `executePolicy` on Base.

**Prize mode:** `POLL_MS=0` — no free fills. Pay-on-hit or `npm run pay` / agent Payer (`postPaidTrigger`).

**Ledger P0:** secrets in **Key Ring** (`wallet-cli ring`), including `OPENROUTER_API_KEY`. Runtime = `WALLET_PASS` + network — **no USB**.

**Submission:** ETHOnline **Start Fresh** (net-new). Graph track pitch = AI **Use Case** agent/app (Receipt Graph drives keeper decisions) — not a tooling MCP product.

## Host + consumer (same process)

```text
┌─ HOST (Blocky402 / Hedera) ─────────────────────────────┐
│  POST /trigger  →  HTTP 402 unpaid  →  settle → execute  │
└─────────────────────────────────────────────────────────┘
         ▲ pays HBAR (~0.001)
┌─ CONSUMER ──────────────────────────────────────────────┐
│  Payer (chat execute)  ·  Autopilot pay-on-hit  ·  CLI   │
│  `npm run pay` / `postPaidTrigger` — no OpenRouter       │
└─────────────────────────────────────────────────────────┘
```

Same Railway service **hosts** the gated `/trigger` and **runs** the paying consumer (Payer / Autopilot / `npm run pay`).

## Key Ring

```bash
npm i -g @ledgerhq/wallet-cli
WALLET_PASS=… wallet-cli ring init --name lga-keeper-host
cd packages/keeper
cp secrets.env.example secrets.env
# fill KEEPER_SESSION_KEY, Hedera, PYTH_API_KEY, OPENROUTER_API_KEY, …
WALLET_PASS=… npm run ring:enroll
rm secrets.env
```

**Edit / fix corrupted enroll** (use Node — do not pipe decrypt through PowerShell `Out-File` / `$plain = …`):

```powershell
cd packages/keeper
$env:WALLET_PASS = '…'
npm run ring:export          # writes secrets.env, prints key names
# edit secrets.env if needed
npm run ring:enroll
Remove-Item secrets.env
```

## Run (prize)

```bash
WALLET_PASS=… POLL_MS=0 npm start
# health.poll.mode === "x402_only"
```

| Route | Gate | Role |
|---|---|---|
| `GET /health` | open | ring + poll mode + Studio MCP URL |
| `GET /policies` | open | Studio policies + MCP hint |
| `GET /payments/recent` | open | x402 attempt audit |
| `POST /agent/chat` | open | Multi-agent JSON (Composer→Clerk/Solver/Payer) |
| `POST /agent/run` | open | Same pipeline as SSE (`text/event-stream`) |
| `POST /quote` | x402 (cheap) | Graph+Pyth eval, no execute |
| `POST /trigger` | x402 | full execute attempt (**host**) |

## x402 qualification

```bash
export KEEPER_URL=https://YOUR.up.railway.app

# unpaid → 402
curl -i -X POST "$KEEPER_URL/trigger" -H "content-type: application/json" -d "{}"

# paid → 200 (consumer)
WALLET_PASS=… KEEPER_URL=$KEEPER_URL/trigger npm run pay

# auto when price hits (pays only on band hit — Autopilot, no LLM)
WALLET_PASS=… KEEPER_URL=$KEEPER_URL npm run pay:on-hit
```

Settlement proof: [docs/proofs/x402-settle.md](../../docs/proofs/x402-settle.md) · Phase B log: [docs/proofs/phase-b.md](../../docs/proofs/phase-b.md)

Facilitator: Blocky402 (`BLOCKY402_FACILITATOR_URL`, typically `https://api.testnet.blocky402.com`) on **hedera:testnet**.

**What is sold:** metered execution attempt (~0.001 HBAR `/trigger`; cheaper `/quote`).

## OpenRouter multi-agent (Phase A)

One Key Ring key (`OPENROUTER_API_KEY`), per-agent models (legacy `*_COORDINATOR` / `*_ORACLE` / `*_SENTINEL` aliases still work):

| Agent | Env | Default role |
|---|---|---|
| Composer | `OPENROUTER_MODEL_COMPOSER` | classify pipeline (no tools) |
| Clerk | `OPENROUTER_MODEL_CLERK` | Receipt Graph + recent payments |
| Solver | `OPENROUTER_MODEL_SOLVER` | explain after code-first `evaluateSwapGate` |
| Payer | — | non-LLM x402 `postPaidTrigger` on execute |
| Autopilot / Driver | — | pay-on-hit + Base fill (no LLM) |

Fallback: `OPENROUTER_MODEL` → `openai/gpt-4o-mini`. Solver defaults to `gpt-4o-mini`.

```bash
# JSON
curl -s -X POST http://127.0.0.1:3001/agent/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Should I execute?"}]}'

# SSE (live ops graph)
curl -N -X POST http://127.0.0.1:3001/agent/run \
  -H 'content-type: application/json' -H 'accept: text/event-stream' \
  -d '{"messages":[{"role":"user","content":"Should I execute?"}]}'
```

Events: `run_start` → `agent_start` / `tool_*` / `edge` / `gate` → `run_end`. UI on `/console/agent` animates **only** from these frames.

Gate: Payer skips `postPaidTrigger` if Solver gate `proceed=false` unless user explicitly overrides.

## HCS + PaymentAudit (Graph)

- Optional `HCS_TOPIC_ID` in ring → memo after settle.
- Optional `PAYMENT_AUDIT_LOG` (deploy `PaymentAuditLog.sol`) → Base event → subgraph `PaymentAudit` with `hcsRef` / payment ref.
- **Composable:** use Subgraph MCP + Receipt Graph (see [docs/SUBGRAPH_MCP.md](../../docs/SUBGRAPH_MCP.md)). HCS fields alone ≠ Composable.

## Env (non-secret)

| Var | Purpose |
|---|---|
| `WALLET_PASS` | Ring password |
| `POLL_MS` | `0` prize; `30000` dev autopoll |
| `KEEPER_URL` | pay / pay-on-hit target |
| `WATCH_MS` | pay-on-hit interval (default 15000) |
| `LGA_SECRETS_SOURCE` | `ring` or `env` |

Railway: [RAILWAY.md](./RAILWAY.md)
