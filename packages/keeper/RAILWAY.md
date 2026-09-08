# Keeper on Railway — Ledger Key Ring (headless)

Laptop off → fills still run **only via paid x402** when `POLL_MS=0`. **No USB on the server.**
Master key never leaves Ledger. Key Ring holds keeper secrets (session key, Pyth, OpenRouter, Hedera).

## What gets deployed

| Piece | Where |
|---|---|
| `secrets.env.enc` | In the Docker image (committed encrypted) |
| `WALLET_PASS` | Railway **Variable** only (never commit) |
| `wallet-cli` | Installed in the image for `ring decrypt` |
| Autopoll | **`POLL_MS=0` (prize)** — free fills off |

## Railway steps

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub**.
2. **Root Directory:** `packages/keeper`
3. Build: Dockerfile (see `railway.toml`).
4. Variables → add:

```text
WALLET_PASS=<same password as wallet-cli ring init>
LGA_SECRETS_SOURCE=ring
LGA_RING_KEY=lga-keeper
POLL_MS=0
```

5. Generate a **public URL** (required for x402 + pay-on-hit).
6. Hit `https://<service>.up.railway.app/health` → expect `keyRing.headless=true`, `poll.mode: "x402_only"`.

### Pay-on-hit worker (second process)

Public server never free-executes. Run watcher elsewhere:

```powershell
$env:WALLET_PASS = "…"
$env:KEEPER_URL = "https://<service>.up.railway.app"
cd packages/keeper
npm run pay:on-hit
```

### After rotate secrets locally

```powershell
cd packages/keeper
$env:WALLET_PASS = "…"
# edit via decrypt → secrets.env (incl. OPENROUTER_API_KEY) → npm run ring:enroll → delete secrets.env
git add secrets.env.enc && git commit -m "chore: ring secrets" && git push
```

## Dev laptop (optional free autopoll)

```text
POLL_MS=30000
```

Label as **dev only** — not the Hedera prize path.
