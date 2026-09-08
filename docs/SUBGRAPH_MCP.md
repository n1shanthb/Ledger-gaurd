# Subgraph MCP (Composable foot-in-door)

Receipt Graph is a **custom** Studio subgraph. Composable judges want **two Graph surfaces** — not HCS alone.

## What we use

1. **Subgraph Studio** — live policies / receipts / (optional) `PaymentAudit`
2. **Subgraph MCP** — NL query against the same Studio endpoint from Cursor / agents

Query URL:

```text
https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4
```

Keeper `/health` and `/policies` return an `mcp` hint string pointing at that URL.

## Demo script for judges

1. Open Subgraph MCP (Graph docs) pointed at the Studio query URL above.
2. Ask: *“List active Guardian policies and latest execution receipts.”*
3. Same data drives the OpenRouter keeper agent tools (`listActivePolicies`) and pay-on-hit.

Pitch: **Subgraph MCP + Receipt Graph** = composition. Hedera HCS/`PaymentAudit` refs are the **audit trail**, not the compose proof.

## Example GraphQL

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
