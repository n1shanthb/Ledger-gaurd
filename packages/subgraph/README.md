# Receipt Graph (The Graph — Base)

Live indexer for LGA policies, execution receipts, and kill-switch events.

**Track:** Best AI Use Case (From Scratch) — not Composable. No mocks.

## Prereqs

1. Deploy **contract v2** (`packages/contracts`) so events match this ABI.
2. Paste the new address + startBlock into `subgraph.yaml` (`source.address`, `source.startBlock`).
3. Subgraph Studio account + deploy key.

## Local codegen / build

```bash
cd packages/subgraph
npm install
npx graph codegen
npx graph build
```

## Deploy to Subgraph Studio

```bash
npx graph auth $GRAPH_DEPLOY_KEY
npx graph deploy ledger-guardian-agent \
  --node https://api.studio.thegraph.com/deploy/ \
  --ipfs https://api.thegraph.com/ipfs/api/v0 \
  --version-label v0.0.1
```

**Live (v0.0.2):** [Studio](https://thegraph.com/studio/subgraph/ledger-guardian-agent) · Query `https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.2`

After sync, set `SUBGRAPH_QUERY_URL` in Key Ring (`npm run ring:enroll`). **Do not mock this URL.**

## Example queries (keeper)

```graphql
{
  policies(where: { active: true }) {
    id
    owner
    token
    policyType
    stopLossPrice
    takeProfitPrice
    maxAmount
    maxSlippageBps
  }
}

{
  executionReceipts(orderBy: timestamp, orderDirection: desc, first: 10) {
    triggerType
    pythPrice
    executionPrice
    actualSlippageBps
    compliant
    txHash
  }
}

{
  killSwitches(orderBy: timestamp, orderDirection: desc, first: 5) {
    owner
    policiesRevoked
    timestamp
  }
}
```

## Entities

| Entity | Source event |
|---|---|
| `Policy` | `PolicyCreated` / `PolicyRevoked` |
| `ExecutionReceipt` | `ExecutionReceipt` (`compliant` is the demo field) |
| `KillSwitch` | `KillSwitchActivated` |

## Subgraph MCP

Point MCP at the Studio query URL. Keeper uses it for “active policies for USDC” style prompts — see `packages/keeper`.
