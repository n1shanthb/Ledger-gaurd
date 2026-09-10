# @lga/graph-data

Composable Graph Gateway layer for LGA: **one Messari query → N protocols**, composed with Receipt Graph + Agent0.

## Prize pitch

> One Messari query → risk + liquidity decision → Ledger/x402 path.

| Graph product | Role |
|---|---|
| Messari Standardized (Gateway) | `decideSafestBorrow` / `decideDeepestWethPool` / `evaluateSwapGate` |
| LGA Receipt Graph (Studio) | Policies in `composeGuardianContext` |
| Agent0 ERC-8004 | Peer MCP/A2A discovery |
| Subgraph MCP | Same queries — see `docs/SUBGRAPH_MCP.md` |

## Setup

```bash
cd packages/graph-data
npm install
export GRAPH_API_KEY=...   # or NEXT_PUBLIC_GRAPH_API_KEY
npm test
```

## Usage (Phase 2 agents)

```ts
import {
  decideSafestBorrow,
  decideDeepestWethPool,
  evaluateSwapGate,
  composeGuardianContext,
} from "@lga/graph-data";

const borrow = await decideSafestBorrow({ assetSymbol: "USDC", network: "base" });
const dex = await decideDeepestWethPool({ baseOnly: true });
const gate = await evaluateSwapGate(); // proceed + reasons — same shape as UI + keeper

const ctx = await composeGuardianContext();
```

## Registry

Pinned in `src/registry.ts` from [messari/subgraphs deployment.json](https://github.com/messari/subgraphs/blob/master/deployment/deployment.json):

- Lending (schema 3.1.0): Compound + Seamless Base; Aave ETH + ARB (Messari Base Aave offline)
- Official live Base Aave (non-Messari): `AAVE_V3_BASE_SUBGRAPH_ID` = `GQFbb95c…` (`reserves` — not in Messari fan-out)
- DEX AMM Extended (schema 4.0.1): Uniswap V3 Base + Optimism + Arbitrum
- Agent0: `6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT`

No mocks. Missing API key throws.
