# Receipt Graph (The Graph — Base)

Live indexer for LGA policies, execution receipts, and kill-switch events.

**Track:** Best AI Use Case (From Scratch) — not Composable. No mocks.

## Prereqs

1. Deploy **GPM** (`packages/contracts`) so events match this ABI.
2. **PaymentAuditLog** live on Base: `0x689ae72edebbf31c59e79b3cd0926a7bd638f495` (startBlock `51045462`).
3. Paste GPM address + startBlock into `subgraph.yaml`.
4. Subgraph Studio account + deploy key.

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

**Live (v0.0.4):** [Studio](https://thegraph.com/studio/subgraph/ledger-guardian-agent) · Query `https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4`

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
| `PaymentAudit` | `PaymentAuditLog.PaymentAudit` (HCS / HashScan refs) |

## Subgraph MCP

See [docs/SUBGRAPH_MCP.md](../../docs/SUBGRAPH_MCP.md) — Composable foot-in-door is MCP + Receipt Graph, not HCS alone.
