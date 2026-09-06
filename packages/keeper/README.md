# LGA Keeper

Headless agent: Receipt Graph → Pyth → x402-gated `POST /trigger` → `executePolicy` on Base.

**Ledger P0:** keeper secrets live in **Key Ring** (`wallet-cli ring`). Runtime decrypt needs network + `WALLET_PASS` — **no USB**. Master key never leaves the Ledger; the ring only holds the keeper session key + API URLs.

## Key Ring (full flow)

```bash
npm i -g @ledgerhq/wallet-cli

# Once on a machine with Ledger USB + Ledger Sync
# Put ring password in OS keychain, then inject (never type into chat/history):
#   macOS: WALLET_PASS=$(security find-generic-password -a default -s ledger-wallet-cli -w)
#   Linux: WALLET_PASS=$(secret-tool lookup service ledger-wallet-cli account default)
WALLET_PASS=… wallet-cli ring init --name lga-keeper-host

cd packages/keeper
cp secrets.env.example secrets.env
# edit secrets.env — KEEPER_SESSION_KEY, SUBGRAPH_QUERY_URL, Hedera ids, …

WALLET_PASS=… npm run ring:enroll
# writes secrets.env.enc under domain key "lga-keeper"
rm secrets.env   # plaintext must not stay on disk / in git
```

Headless VPS / CI (no Ledger plugged in):

```bash
# same ring membership + WALLET_PASS on the host; copy secrets.env.enc
WALLET_PASS=… npm start
curl -s localhost:3001/health   # keyRing.headless=true, source=ring
```

`GET /health` → `keyRing: { source, headless, walletCli, encPresent }`.

Local hack without ring: `LGA_SECRETS_SOURCE=env npm run start:env` (not prize-ready).

Also enroll the session address on-chain (policy owner):

```text
SessionKeyValidator.setSessionKey(keeperAddress, true)
```

## Run

```bash
cd packages/keeper
npm install
WALLET_PASS=… npm start
```

`GET /health` · `GET /policies` · `POST /trigger`

**Laptop off:** deploy with Key Ring on Railway — see [RAILWAY.md](./RAILWAY.md) (also cheap INR VPS options).

## x402 payment flow (Hedera)

```text
client POST /trigger
        │
        ├─ no payment header
        │     → 402 Payment Required
        │        network: hedera:testnet (or mainnet via secrets)
        │        amount: 100000 tinybars (~0.001 HBAR)
        │
        └─ X-PAYMENT present
              → Blocky402 verify → settle
              → Receipt Graph active policies
              → Pyth VAA → executePolicy on Base (session key from Key Ring)
```

**What is sold:** one evaluated trigger attempt, not Base gas.

```bash
WALLET_PASS=… npm run pay
```

## Subgraph MCP

`/health` and `/policies` expose the Studio URL as MCP target.

## Env vars (non-secret)

| Var | Purpose |
|---|---|
| `WALLET_PASS` | Ring password (from OS keychain) |
| `LGA_RING_KEY` | Domain key name (default `lga-keeper`) |
| `LGA_SECRETS_ENC` | Path to `secrets.env.enc` |
| `LGA_SECRETS_SOURCE` | `ring` (default if enc exists) or `env` |
| `KEEPER_PORT` | default `3001` |
| `WALLET_CLI_BIN` | override `wallet-cli` path |
