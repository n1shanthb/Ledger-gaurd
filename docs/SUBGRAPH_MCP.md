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

## Demo script (≤3 min)

1. Open console → **Compose** workspace (verdicts + gate strip; matrix per protocol).  
2. Point Subgraph MCP at Studio URL; ask for active policies.  
3. Ask MCP / agent: “Safest Base USDC borrow…” then “would you gate a Guardian swap?”  
4. Pitch: *“One Messari query → risk + liquidity decision → Ledger/x402 path.”*

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
