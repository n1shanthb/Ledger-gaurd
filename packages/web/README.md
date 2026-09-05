# LGA Web — Series A protocol frontend

Next.js App Router site for Ledger Guardian Agent.

## Run

```bash
cd packages/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Purpose |
|---|---|
| `/` | Protocol landing — brand, flow, pillars, live proof links |
| `/console` | Live Receipt Graph + **Ledger DMK** clear-sign (policy / kill) |

## Ledger (WebHID)

Chrome or Edge on desktop. Unlock device → open Ethereum app → **Connect Ledger** on `/console`.

Signing flow (works **today** without registry merge):

1. OLED shows a human-readable **policy review** message (type, asset, stop/take, amount, slip)
2. OLED then signs the Base `setGuardianPolicy` / `killSwitch` transaction

Full ERC-7730 field rendering on the tx itself also needs a registry PR + optional `NEXT_PUBLIC_LEDGER_ORIGIN_TOKEN`.

Account assets + live Pyth spots load after **Read address + balances** — use **Protect** to prefill a stop ~5% below spot.

## Env

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_SUBGRAPH_QUERY_URL` defaults to the Studio deployment if unset.
`NEXT_PUBLIC_BASE_RPC_URL` is used when broadcasting Ledger-signed txs.
