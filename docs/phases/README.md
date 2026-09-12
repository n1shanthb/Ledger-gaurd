# LGA multi-agent phases (goal docs)

Run **one phase at a time** with Cursor `/goal`. Verify proofs before starting the next.

| Order | File | Objective (short) |
|-------|------|-------------------|
| 1 | [phase-a-core-multi-agent.md](./phase-a-core-multi-agent.md) | Trust-boundary agents + LLM off hot path + 3D/SSE |
| 1b | [phase-a2-nl-policy-intake.md](./phase-a2-nl-policy-intake.md) | NL policy intake — Composer questions + draft form + HITL |
| 2 | [phase-b-x402-host-proof.md](./phase-b-x402-host-proof.md) | Prove `/trigger` host+consumer; Start Fresh / Use Case docs |
| 3 | [phase-c1-mcp-clerk.md](./phase-c1-mcp-clerk.md) | Clerk/status via Subgraph MCP NL (Graph named ask) |
| 4 | [phase-c2-capability-broker.md](./phase-c2-capability-broker.md) | Key Ring capability broker (Ledger named ask) |
| 5 | [phase-d-hedera-extras.md](./phase-d-hedera-extras.md) | HCS sink, optional gated `/solve`, HCS-14 (extras only) |

## How to arm a goal

After you verify the previous phase proofs:

```text
/goal Complete docs/phases/<file> to Done-when criteria with proofs captured
```

Example:

```text
/goal Complete docs/phases/phase-a-core-multi-agent.md to Done-when criteria with proofs captured
```

## Rules (every phase)

- Copy: “Master key never leaves Ledger”; “Key Ring holds keeper secrets.”
- Do not mock Subgraph Studio data.
- Do not put LLM on the band-hit → fill hot path.
- Prefer small commits; no `.env` / plaintext secrets in git.

## Parent plan

Full architecture notes: Cursor plan `real_multi-agent_lga` (phases supersede it for execution order).
