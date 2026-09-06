# Keeper on Railway — Ledger Key Ring (headless)

Laptop off → fills still run. **No USB on the server.** Master key never leaves Ledger.
Key Ring holds keeper secrets; Railway only gets `WALLET_PASS` + the encrypted blob.

## What gets deployed

| Piece | Where |
|---|---|
| `secrets.env.enc` | In the Docker image (committed encrypted) |
| `WALLET_PASS` | Railway **Variable** only (never commit) |
| `wallet-cli` | Installed in the image for `ring decrypt` |
| Autopoll | `POLL_MS=30000` |

## Railway steps

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub** (`CircuitVault-` / this repo).
2. **Root Directory:** `packages/keeper`
3. Build: Dockerfile (see `railway.toml`).
4. Variables → add:

```text
WALLET_PASS=<same password as wallet-cli ring init>
LGA_SECRETS_SOURCE=ring
LGA_RING_KEY=lga-keeper
POLL_MS=30000
```

5. Generate a public URL if you want `npm run pay` / x402 from outside (optional for autopoll).
6. Deploy. Hit `https://<service>.up.railway.app/health` → expect `keyRing.source: "ring"`, `headless: true`.

### After rotate secrets locally

```powershell
cd packages/keeper
$env:WALLET_PASS = "…"
# edit via decrypt → secrets.env → npm run ring:enroll → delete secrets.env
git add secrets.env.enc && git commit -m "chore: ring secrets" && git push
```

Railway rebuilds with the new `.enc`. `WALLET_PASS` stays the same unless you rotated the ring password.

### If decrypt fails on Railway

- Confirm `WALLET_PASS` matches local ring init.
- Confirm `secrets.env.enc` is the latest from Key Ring enroll.
- Logs: `wallet-cli ring decrypt failed` → password or missing `wallet-cli` in image.

## Local check before deploy

```powershell
cd packages/keeper
docker build -t lga-keeper .
docker run --rm -e WALLET_PASS -e PORT=3001 -p 3001:3001 lga-keeper
curl http://127.0.0.1:3001/health
```

## Cheap always-on options (INR, rough)

| Option | Ballpark | Notes |
|---|---|---|
| **Railway** hobby | ~₹400–800/mo usage | Easiest Docker; Key Ring as above |
| **Hoststack / VCCL / GigaNodes** (India) | ~₹300–600/mo | UPI + GST; install Node + `wallet-cli`, `scp` `.enc`, systemd |
| **AWS Lightsail Mumbai** Nano | ~₹300/mo | Mumbai; card/forex sometimes annoying |
| **Hetzner CX22** (EU/SG) | ~₹400–500/mo | Best RAM/₹; higher latency to India |
| **Oracle Cloud free ARM** (Mumbai/Hyd) | ₹0 | Free tier; fiddly, not always available |

**Cheapest serious pick for India + UPI:** Hoststack / VCCL ~₹300–400/mo, 1 GB RAM enough for keeper.

### VPS (Ledger way) one-liner sketch

```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g @ledgerhq/wallet-cli tsx
# copy packages/keeper + secrets.env.enc
export WALLET_PASS='…'
export LGA_SECRETS_SOURCE=ring
export POLL_MS=30000
npm i
# systemd unit with Environment=WALLET_PASS=…  (or EnvironmentFile=)
npm start
```

Same story as Railway: ring blob + password, no Ledger USB, no raw session key in git.
