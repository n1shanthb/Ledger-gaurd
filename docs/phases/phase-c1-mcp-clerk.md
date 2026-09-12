# Phase C1 — Subgraph MCP Clerk (Graph named differentiator)

**Goal slug:** `phase-c1-mcp-clerk`  
**Depends on:** Phase A verified (Phase B preferred for prize narrative)  
**Blocks:** none hard; do before C2 if time-boxed

## Objective

Make **Receipt Clerk** (status pipeline) answer policy/receipt questions via **Subgraph MCP / natural-language Graph path**, not only hardcoded GraphQL in `subgraph.ts`. Judges should see the track’s named beat: query live subgraphs through Subgraph MCP in natural language. Keep LGA pitched as the **agent/app** that uses Graph — not a reusable tooling MCP product.

## In scope

- Status / Clerk agent path: NL or tool that goes through Subgraph MCP client or documented MCP-backed keeper endpoint
- Demo script: e.g. “what policies are active?” / “recent execution receipts?” answered with live Studio data
- Update `docs/SUBGRAPH_MCP.md` with Clerk-centric judge prompts + Phase A agent names
- Proof that responses are live Studio data (not mocks)

## Out of scope

- Capability broker (Phase C2)
- Changing Autopilot hot-path poll implementation (may still use GraphQL; Clerk is the NL surface)
- Substreams one-prompt challenge (defer / skip)
- Messari fan-out rewrites

## Deliverables

| Artifact | Notes |
|----------|--------|
| Clerk/status MCP path | Code under `packages/keeper/src/agent/` + any MCP helper |
| Docs | `docs/SUBGRAPH_MCP.md`, `docs/proofs/phase-c1.md` |
| Optional UI | Status chat copy pointing at MCP |

## Implementation checklist

1. Inventory current Clerk/status tools (`listActivePolicies`, etc.).
2. Wire reads through Subgraph MCP (or keeper wrapper that is the MCP consumer judges can point Claude/Cursor at).
3. Ensure Studio API key / URL from env/Key Ring — live only.
4. Add judge prompts to SUBGRAPH_MCP.md for Clerk questions.
5. Capture a real Q→A transcript in proofs.

## Proofs

| # | Proof | How |
|---|--------|-----|
| C1-1 | MCP path exists | Code + config references Subgraph MCP / Studio; not mock fixtures |
| C1-2 | Live answer | Transcript or log: NL question → policy/receipt fields matching Studio |
| C1-3 | Agent attribution | SSE or logs show `clerk` (or status) for the read |
| C1-4 | Pitch | Docs say Use Case agent/app; Clerk is not sold as standalone tooling prize |

## Done when

- C1-1–C1-4 in `docs/proofs/phase-c1.md`.
- A judge following SUBGRAPH_MCP.md can reproduce an NL policy question.

## `/goal` prompt

```text
/goal Complete docs/phases/phase-c1-mcp-clerk.md to Done-when criteria with proofs in docs/proofs/phase-c1.md
```
