# Phase C1 proofs — Subgraph MCP Clerk

**Date:** 2026-09-12  
**Slug:** `phase-c1-mcp-clerk`  
**Studio:** `https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4`  
**Artifacts:** `docs/proofs/phase-c1/`

---

## C1-1 — MCP path exists

Code:

- `packages/keeper/src/agent/subgraphMcp.ts` — NL → Receipt Graph GraphQL → live Studio (`source: "subgraph-mcp-consumer"`)
- Tool `queryReceiptGraphNl` in `toolDefs.ts` / `tools.ts`
- Clerk (`clerk.ts`) forces `queryReceiptGraphNl` first; no mocks
- Not the `@graphprotocol/subgraph-mcp` wire protocol in-process — same Studio data; Cursor MCP optional for judges

Config / docs: Studio URL + Clerk prompts in `docs/SUBGRAPH_MCP.md`.

---

## C1-2 — Live answer

```bash
curl -sN -X POST http://127.0.0.1:3001/agent/run \
  -H "content-type: application/json" -H "accept: text/event-stream" \
  -d '{"messages":[{"role":"user","content":"recent execution receipts?"}]}'
```

**Capture:** [`phase-c1/c1-receipts.sse.txt`](./phase-c1/c1-receipts.sse.txt)

| Field | Live Studio match |
|-------|-------------------|
| tool summary | `mcp receipts 2` |
| triggerType | `TAKE_PROFIT` |
| txHash | `0x41a4e8ce…f1ac51`, `0x5941f3d2…5303fe8` |
| pythPrice | `250129516596`, `249895119138` |

Policies ask (`what policies are active?`): [`c1-policies.sse.txt`](./phase-c1/c1-policies.sse.txt) → `mcp policies 0` (live empty set; matches Studio).

---

## C1-3 — Agent attribution

Both SSE runs:

- `composer` → `pipeline=status`
- `edge` composer→clerk
- `agent_start` / `tool_start` **`clerk`** / `queryReceiptGraphNl`
- `run_end` with `**Clerk**` reply

No `listActivePolicies` on these runs after Clerk MCP force.

---

## C1-4 — Pitch

| Doc | Phrase |
|-----|--------|
| `docs/SUBGRAPH_MCP.md` | Clerk + Subgraph MCP; **Use Case agent/app**; not tooling product |
| `KeeperAgentPanel.tsx` | Clerk status uses Subgraph MCP → live Receipt Graph |
| Tool / MCP result `pitch` | LGA Use Case agent/app — Clerk consumes live Receipt Graph |

---

## Reproduce (judges)

1. Follow [SUBGRAPH_MCP.md § Clerk](../SUBGRAPH_MCP.md)
2. Agent chat: `what policies are active?` / `recent execution receipts?`
3. Watch SSE: `clerk` + `queryReceiptGraphNl`

---

## Done-when

| Item | Status |
|------|--------|
| C1-1–C1-4 in this file | yes |
| Judge can reproduce NL policy/receipt Q | yes |
| No Phase C2/D mixed | yes |
