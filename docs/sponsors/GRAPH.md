# Sponsor brief — The Graph

**Track pitch:** Best AI **Use Case** (From Scratch) — Receipt Graph is load-bearing for keeper automation. Optional second surface: Composable / Messari fan-out via `@lga/graph-data`.  
**Network:** Indexes **Base mainnet** Guardian events. Studio + Gateway are live production query surfaces (no mocked subgraph data).

![LGA six-role architecture](../assets/lga-six-role-architecture.svg)

**Receipt Clerk** is the only LLM role allowed to query Receipt Graph. **Band Autopilot** loads policies from the same index before Pyth / fill.

---

## Claim

The Graph is not a dashboard decoration. The keeper’s Autopilot / paid `/trigger` cycle **loads active policies from the Receipt Graph** before any Pyth comparison or Base mainnet `executePolicy`. Clerk answers status by forcing a live Studio/Gateway GraphQL path — the same indexed entities automation uses. Without Graph, LGA has no authoritative list of policies to evaluate and no indexed compliance trail for fills.

**Production shape:** subgraph deployed and queryable; web Activity + congrats replay real `ExecutionReceipt` rows; keeper caches + cooldown so Autopilot survives Studio rate limits without fake data.

---

## What breaks without it

If Receipt Graph were removed:

- [`packages/keeper/src/cycle.ts`](../../packages/keeper/src/cycle.ts) calls `fetchActivePolicies(secrets.graphUrl, …)` — with no URL / empty index, Autopilot and paid cycles evaluate **zero** policies. x402 can still settle HBAR, but **no Base fill can be decided from indexed state**.
- Clerk’s only forced tool is `queryReceiptGraphNl` ([`clerk.ts`](../../packages/keeper/src/agent/clerk.ts)). Status chat becomes fiction or silence — there is no alternate “policy DB.”
- Post-fill `ExecutionReceipt` / `PaymentAudit` entities disappear from the audit story judges query in Studio.

Payment alone never substitutes for Graph: paid settle proofs intentionally show `evaluated:0` when no in-band policy exists ([`docs/proofs/x402-settle.md`](../proofs/x402-settle.md)).

---

## Live proofs (open these)

| Artifact | Link |
|---|---|
| Studio project | https://thegraph.com/studio/subgraph/ledger-guardian-agent |
| Studio query `v0.0.4` | https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4 |
| Explorer / Gateway subgraph | https://thegraph.com/explorer/subgraphs/GfvNLa3ym7X6bNDNm6oyqvHGgW2anbzTKhEo7cFPjhvz |
| Mainnet fill (indexed path) | https://basescan.org/tx/0xb6f315a435e6dfd19607d9b662fdb0415fd476a21937f0a2c7b8d78d882371d3 |
| Earlier Clerk-indexed fills | https://basescan.org/tx/0x41a4e8ced5804985faaac056f03567460e15f66dbec2f8062065744448f1ac51 |
| Live Activity UI | https://ledger-gaurd.vercel.app/protect/activity |
| MCP / Use Case pitch | [`docs/SUBGRAPH_MCP.md`](../SUBGRAPH_MCP.md) |
| Band Autopilot (Graph → pay) | [`packages/keeper/src/payOnHit.ts`](../../packages/keeper/src/payOnHit.ts) |
| Cycle (Graph → Pyth → Driver) | [`packages/keeper/src/cycle.ts`](../../packages/keeper/src/cycle.ts) |
| Receipt Clerk | [`packages/keeper/src/agent/clerk.ts`](../../packages/keeper/src/agent/clerk.ts) |
| Subgraph MCP consumer | [`packages/keeper/src/agent/subgraphMcp.ts`](../../packages/keeper/src/agent/subgraphMcp.ts) |
| Schema | [`packages/subgraph/schema.graphql`](../../packages/subgraph/schema.graphql) |

---

## Where it's implemented

| Path | Role |
|---|---|
| [`packages/subgraph/schema.graphql`](../../packages/subgraph/schema.graphql) | `Policy`, `ExecutionReceipt`, `PaymentAudit`, `KillSwitch` entities |
| [`packages/subgraph/`](../../packages/subgraph/) | Mappings + Studio deploy for `ledger-guardian-agent` |
| [`packages/keeper/src/cycle.ts`](../../packages/keeper/src/cycle.ts) | Load-bearing: `fetchActivePolicies` before trigger / execute |
| [`packages/keeper/src/agent/subgraphMcp.ts`](../../packages/keeper/src/agent/subgraphMcp.ts) | NL → GraphQL → live endpoint (`source: "subgraph-mcp-consumer"`) |
| [`packages/keeper/src/agent/clerk.ts`](../../packages/keeper/src/agent/clerk.ts) | Forces `queryReceiptGraphNl`; Clerk-only Graph path |
| [`packages/keeper/src/agent/tools.ts`](../../packages/keeper/src/agent/tools.ts) | `ClerkCtx` brand + `runClerkTool` for Graph tools |
| [`packages/keeper/src/agent/solver.ts`](../../packages/keeper/src/agent/solver.ts) | Rejects `queryReceiptGraphNl` / `listActivePolicies` — “Receipt Graph is Clerk-only” |
| [`packages/keeper/src/agent/orchestrate.ts`](../../packages/keeper/src/agent/orchestrate.ts) | `DISPATCH`: only `status` → Clerk; comment: other handlers must not call Receipt Graph MCP |
| [`packages/graph-data/`](../../packages/graph-data/) | Messari lending / DEX fan-out (`decideSafely…` / swap gate) |
| [`packages/web/src/app/api/receipt-graph/route.ts`](../../packages/web/src/app/api/receipt-graph/route.ts) | Browser-safe Graph proxy (Gateway-oriented; see limitations) |
| [`docs/SUBGRAPH_MCP.md`](../SUBGRAPH_MCP.md) | Judge-facing MCP / Use Case copy |

---

## Proof artifacts

### 1 — Live Studio query URL

https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4  

Also listed in [`docs/HACKATHON.md`](../HACKATHON.md) and keeper `/health` `mcp` string (see Railway capture [`docs/proofs/phase-c2/railway-health.json`](../proofs/phase-c2/railway-health.json)).

Studio project UI: https://thegraph.com/studio/subgraph/ledger-guardian-agent

### 2 — Live Clerk MCP tool-call (SSE)

Ask: “recent execution receipts?”

Capture: [`docs/proofs/phase-c1/c1-receipts.sse.txt`](../proofs/phase-c1/c1-receipts.sse.txt)

| Evidence | Value |
|---|---|
| Edge | `composer` → `clerk` |
| Tool | `queryReceiptGraphNl` |
| Summary | `mcp receipts 2` |
| Fill txs (indexed) | `0x41a4e8ced5804985faaac056f03567460e15f66dbec2f8062065744448f1ac51`, `0x5941f3d2a8d598797fcf07b7d3103cc06cd1e3663649cca60c1c9d4f85303fe8` |

Basescan (fill #1): https://basescan.org/tx/0x41a4e8ced5804985faaac056f03567460e15f66dbec2f8062065744448f1ac51  
Basescan (fill #2): https://basescan.org/tx/0x5941f3d2a8d598797fcf07b7d3103cc06cd1e3663649cca60c1c9d4f85303fe8

Policies ask (live empty set): [`docs/proofs/phase-c1/c1-policies.sse.txt`](../proofs/phase-c1/c1-policies.sse.txt) → `mcp policies 0`.

Write-up: [`docs/proofs/phase-c1.md`](../proofs/phase-c1.md).

### 3 — GraphQL query artifact (PaymentAudit)

Query file: [`docs/proofs/phase-d/studio-query.json`](../proofs/phase-d/studio-query.json)

```graphql
{ paymentAudits(first: 5, orderBy: timestamp, orderDirection: desc) {
    attemptId hcsRef hederaPaymentRef baseTx timestamp
}}
```

Captured response: [`docs/proofs/phase-d/studio-payment-audits.json`](../proofs/phase-d/studio-payment-audits.json) → `{"data":{"paymentAudits":[]}}`  
(Empty is still a live Studio answer — bridge may be inactive; see limitations.)

[PROOF NEEDED: paste a non-empty `paymentAudits` / `executionReceipts` GraphQL response JSON from Studio Playground if you want a richer screenshot for judges]

### 4 — Composer / Solver / Payer do not own Graph

| Mechanism | Location |
|---|---|
| `DISPATCH` only routes `status` → Clerk | [`orchestrate.ts` ~456–463](../../packages/keeper/src/agent/orchestrate.ts) |
| Solver hard-reject Graph tool names | [`solver.ts` `ALLOW` + clerk-only errors](../../packages/keeper/src/agent/solver.ts) |
| `ClerkCtx` brand for Graph tools | [`tools.ts`](../../packages/keeper/src/agent/tools.ts) |
| Payer = `postPaidTrigger` only | [`paidTrigger.ts`](../../packages/keeper/src/paidTrigger.ts) — no GraphQL client |

Audit matrix: [`docs/AGENT_AUDIT.md`](../AGENT_AUDIT.md) § Data access.

### 5 — Screenshot placeholders

![Clerk SSE / Graph answer](../assets/graph-clerk-sse.png)
<!-- REPLACE: Agent UI or terminal showing tool_end queryReceiptGraphNl ok + receipt tx hashes -->

![Studio playground receipts](../assets/graph-studio-playground.png)
<!-- REPLACE: Subgraph Studio playground with executionReceipts query + non-empty data if available -->

---

## Track alignment

| Requirement (name) | How we satisfy it |
|---|---|
| Graph is **load-bearing** live data source | Cycle fetches policies from Graph before execute — proof: code path + C1 live receipts |
| **Live data** from Subgraph Studio (no mocks) | Studio URL + SSE captures; `subgraphMcp.ts` hits configured URL |
| **Meaningful work** / automation | Policy → Pyth → trigger decision in `cycle.ts` / executor |
| **Subgraph MCP** in agent flow | Clerk `forceToolName: "queryReceiptGraphNl"` — proof #2 |
| Start Fresh / Use Case agent-app (not tooling product) | [`docs/SUBGRAPH_MCP.md`](../SUBGRAPH_MCP.md) pitch |
| Composable / Messari one-query-N | [`packages/graph-data`](../../packages/graph-data) + Solver tools `compareLendingRisk` / `findDeepestWethPool` |

Satisfies: **“consume live data from a Graph provider”** — see proof #1–#2.  
Satisfies: **“meaningful automation / decisions”** — see `cycle.ts` + indexed fill txs in proof #2 (fills are prior Autopilot/Driver work indexed into Graph; a given paid `/trigger` may still return `evaluated:0`).

---

## Honest limitations

1. **Owner-scoping** — Clerk Graph lists are not strictly filtered to the connected wallet unless the NL question / future filter says so ([`AGENT_AUDIT.md`](../AGENT_AUDIT.md) § Policy history).
2. **Studio free-tier 429** — over-eager Graph calls throttle demos; 
3. **Web vs keeper endpoint split** — `packages/web/.../receipt-graph/route.ts` **rejects Studio URLs** (503) and defaults toward Gateway subgraph id `GfvNLa3…`. Keeper proofs still document Studio `v0.0.4`. Judges should not assume one URL for both surfaces until env is unified.


[PROOF NEEDED: Gateway subgraph deployment confirmation (same schema as Studio) if you demo web Activity exclusively against Gateway]
