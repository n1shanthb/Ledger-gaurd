# Subgraph MCP + Composable surfaces

LGA claims **two Graph prizes**:

1. **AI Use Case (From Scratch)** — custom Receipt Graph drives keeper decisions  
2. **Composable / Standardized** — one Messari query → N protocols → a **decision** the keeper agent gates on

**Pitch:** One Messari query → risk + liquidity decision → Ledger/x402 path.

## Graph products we compose

| Product | Endpoint | Role |
|---|---|---|
| Receipt Graph (Studio) | `https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4` | Policies, receipts, PaymentAudit |
| Messari Lending (Gateway) | Compound + Seamless Base; Aave ETH + ARB | Same `markets` document |
| Messari DEX AMM Extended | Uniswap V3 Base + Optimism + Arbitrum | Same `liquidityPools` document |
| Agent0 ERC-8004 | `6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT` | Peer MCP/A2A discovery |
| Subgraph MCP | NL over the above | Judge demo |

Auth Gateway with `GRAPH_API_KEY` / `NEXT_PUBLIC_GRAPH_API_KEY`.

Package: [`packages/graph-data`](../packages/graph-data/README.md) — `decideSafestBorrow`, `decideDeepestWethPool`, `evaluateSwapGate`, plus fan-out helpers.

## Clerk + Subgraph MCP (Phase C1 — Graph named beat)

LGA is the **AI Use Case agent/app**. Receipt **Clerk** answers status questions via a **Subgraph MCP consumer path** (NL → live Subgraph Studio Receipt Graph). Clerk is **not** sold as a standalone tooling MCP product.

Clerk hits the **same live Studio endpoint** Subgraph MCP queries (`queryReceiptGraphNl`); for IDE demos use `npx @graphprotocol/subgraph-mcp` in Cursor — LGA is the agent/app, not the MCP server product.

**Judge flow (reproduce):**

1. Point Cursor/Claude Subgraph MCP at Gateway with your Studio API key *or* use LGA Agent chat (status pipeline).
2. Ask Clerk NL questions against Receipt Graph Studio  
   `https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4`
3. Expect live fields (`policies`, `executionReceipts`, `paymentAudits`) — no mocks.

### Clerk judge prompts

```text
what policies are active?
```

```text
recent execution receipts?
```

```text
List active Guardian policies and latest execution receipts from the LGA Receipt Graph.
```

Keeper tool: `queryReceiptGraphNl` (agent `clerk`, SSE `tool_start` / `tool_end`). Proofs: [docs/proofs/phase-c1.md](./proofs/phase-c1.md).

## MCP prompts (judges)

### Receipt Graph (AI Use Case)

```text
List active Guardian policies and latest execution receipts from the LGA Receipt Graph.
```

### Decision machine (Composable)

```text
Safest Base USDC borrow across Messari lending deployments
```

```text
Deepest WETH pool; would you gate a Guardian swap?
```

### Messari standards leverage

```text
Run the same Messari lending markets query across Compound V3 Base, Seamless Base, Aave V3 Ethereum, and Aave V3 Arbitrum.
Compare utilization — one schema, N protocols. Rank safest Base USDC borrow.
```

```text
Run the same Messari liquidityPools query (orderBy totalValueLockedUSD) across Uniswap V3 Base, Optimism, and Arbitrum. Which WETH pool is deepest?
```

### Compose

```text
Compose Guardian context: active Receipt Graph policies + Messari decisions (borrow risk + WETH depth) + evaluateSwapGate.
```

## Phase A agents (events drive UI)

Composer → **Clerk** (Receipt Graph status) → **Market Solver** (code-first Messari/Pyth gate) → **Payer** (non-LLM x402 `/trigger`). Autopilot + Driver own pay-on-hit → Base fill (no LLM).

- Keeper: `POST /agent/run` streams `AgentEvent` SSE; `/console/agent` graph only animates from those events.
- Same decide/gate documents as Compose — no mock animation loops.
- One OpenRouter key; per-agent models via `OPENROUTER_MODEL_*` in Key Ring.

## Demo script (≤3 min)

1. Open console → **Compose** (verdicts + gate).  
2. Open **Agent** → ask “what policies are active?” → watch **Clerk** + `queryReceiptGraphNl` (Subgraph MCP path).  
3. Ask “recent execution receipts?” — live Studio `executionReceipts`.  
4. Pitch: *“Use Case agent/app — Clerk NL over Receipt Graph via Subgraph MCP; not a tooling MCP product.”* · pool = **Start Fresh**.  

## Receipt Graph example

```graphql
{
  policies(where: { active: true }, first: 5) {
    id policyType stopLossPrice takeProfitPrice
  }
  executionReceipts(first: 5, orderBy: timestamp, orderDirection: desc) {
    triggerType pythPrice compliant txHash
  }
  paymentAudits(first: 5, orderBy: timestamp, orderDirection: desc) {
    attemptId hcsRef hederaPaymentRef baseTx
  }
}
```

(`paymentAudits` via PaymentAuditLog `0x689ae72e…` on Base → subgraph v0.0.4.)

**Graph ↔ Hedera:** paid x402 settles write HCS memos (`hcs://topic/seq`); keeper emits `PaymentAudit` on Base with `hcsRef` + `hederaPaymentRef` (includes `agent=` tag) **only when** `PAYMENT_AUDIT_LOG` is set. Clerk audits NL reads Studio — empty `paymentAudits` means the bridge has not fired yet, not mocked data.

## Standard lending document (fan-out)

```graphql
{
  _meta { block { number } }
  protocols(first: 1) { schemaVersion methodologyVersion }
  markets(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id name
    inputToken { symbol }
    totalValueLockedUSD totalDepositBalanceUSD totalBorrowBalanceUSD
    rates { side type rate }
  }
}
```

Same string → gateway IDs in `packages/graph-data/src/registry.ts` (Messari Base Aave offline — ETH/ARB Aave + Base Compound/Seamless).
