# LGA Keeper

Headless agent: Receipt Graph → Pyth → **x402-gated** `POST /trigger` → `executePolicy` on Base.

**Prize mode:** `POLL_MS=0` — no free fills. Pay-on-hit or `npm run pay` / agent `requestExecutionAttempt`.

**Ledger P0:** secrets in **Key Ring** (`wallet-cli ring`), including `OPENROUTER_API_KEY`. Runtime = `WALLET_PASS` + network — **no USB**.

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

## Run (prize)

```bash
WALLET_PASS=… POLL_MS=0 npm start
# health.poll.mode === "x402_only"
```

| Route | Gate | Role |
|---|---|---|
| `GET /health` | open | ring + poll mode |
| `GET /policies` | open | Studio policies + MCP hint |
| `GET /payments/recent` | open | x402 attempt audit |
| `POST /agent/chat` | open | OpenRouter tools (key from ring) |
| `POST /quote` | x402 (cheap) | Graph+Pyth eval, no execute |
| `POST /trigger` | x402 | full execute attempt |

## x402 qualification

```bash
export KEEPER_URL=https://YOUR.up.railway.app

# unpaid → 402
curl -i -X POST "$KEEPER_URL/trigger" -H "content-type: application/json" -d "{}"

# paid → 200
WALLET_PASS=… KEEPER_URL=$KEEPER_URL/trigger npm run pay

# auto when price hits (pays only on band hit)
WALLET_PASS=… KEEPER_URL=$KEEPER_URL npm run pay:on-hit
```

Settlement proof template: [docs/proofs/x402-settle.md](../../docs/proofs/x402-settle.md)

**What is sold:** metered execution attempt (~0.001 HBAR `/trigger`; cheaper `/quote`).

## OpenRouter agent

`POST /agent/chat` body: `{ "messages": [{ "role": "user", "content": "…" }] }`

Tools: `listActivePolicies`, `getPythSpot`, `proposeGuardianPolicy`, `requestExecutionAttempt` (paid `/trigger`), `getRecentPayments`.

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
