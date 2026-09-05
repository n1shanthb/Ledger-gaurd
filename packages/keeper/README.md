# LGA Keeper

Headless agent: Receipt Graph → Pyth → x402-gated `POST /trigger` → `executePolicy` on Base.

Secrets come from **Key Ring CLI** (`wallet-cli ring`), not committed `.env`.

## Key Ring (Ledger P0)

```bash
npm i -g @ledgerhq/wallet-cli
wallet-cli ring init
wallet-cli ring set KEEPER_SESSION_KEY 0xYOUR_SESSION_PRIVATE_KEY
wallet-cli ring set BASE_RPC_URL https://mainnet.base.org
wallet-cli ring set SUBGRAPH_QUERY_URL https://api.studio.thegraph.com/query/<id>/ledger-guardian-agent/<ver>
wallet-cli ring set GUARDIAN_POLICY_MANAGER_ADDRESS 0xV2_ADDRESS
```

Local-only fallback: copy `../../.env.example` keys into the environment. Prod must use the ring.

Also enroll the session key on-chain:

```text
SessionKeyValidator.setSessionKey(keeperAddress, true)  // from policy owner
```

## Run

```bash
cd packages/keeper
npm install
npm start
```

`GET /health` · `GET /policies` · `POST /trigger`

## x402 payment flow (Hedera)

```text
client POST /trigger
        │
        ├─ no X-PAYMENT header
        │     → 402 Payment Required
        │        network: hedera:testnet
        │        amount: 100000 tinybars (~0.001 HBAR)
        │        facilitator: https://api.testnet.blocky402.com
        │
        └─ X-PAYMENT present
              → Blocky402 POST /verify
              → Blocky402 POST /settle
              → poll Receipt Graph (active policies)
              → Pyth Hermes spot + fresh VAA (never cached)
              → executePolicy(policyId, vaas) on Base
              → ExecutionReceipt → subgraph
```

**What is sold:** one evaluated trigger attempt, not Base gas.

Paid E2E (Hedera prize): hit `/trigger` without payment (see 402), pay with `@x402/hedera` or a Blocky402 client, retry with `X-PAYMENT`, confirm settle tx + Base receipt.

## Subgraph MCP

`GET /health` and `GET /policies` return the Studio URL as the MCP target. Prompt example: *“active policies for USDC with stop-loss below spot”* → GraphQL → keeper decides whether to pay `/trigger`.

## Env (local only)

See repo `.env.example`. `KEEPER_PORT=3001`.
