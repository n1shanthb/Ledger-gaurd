# Sponsor brief — Ledger

**Track:** AI Agents × Ledger · **Start from Scratch** (not Continuity).

---

## Claim

Ledger is the only path that creates or destroys on-chain delegation. Users clear-sign Guardian policies and kill on a physical OLED (DMK). Keeper secrets — session key, OpenRouter, Graph, Hedera pay creds — live in **Key Ring** (`wallet-cli ring`), not in a chat model’s context. A capability broker mints time-boxed scopes (`pay:trigger`, `execute:policy:<id>`, `read:graph`, …) so workers act without exposing raw keys to Composer / Solver / Clerk.

**Copy we use:** Master key never leaves Ledger. Key Ring holds keeper secrets.

---

## What breaks without it

If Ledger / Key Ring boundaries were removed:

- Policy creation would reduce to “server or LLM builds a signable tx and broadcasts it.” Composer/Solver output alone could move funds — the **HITL guarantee collapses**.
- The session key would sit in `.env` or in tool JSON returned to the model. `redactSecrets` and broker scopes would be theater.
- Kill switch would become a soft UI flag instead of a device-confirmed revoke of policies + session keys ([`packages/hardware-test/src/killSwitchTx.ts`](../../packages/hardware-test/src/killSwitchTx.ts)).

x402 payment and Graph indexing cannot replace device approval: they meter and record attempts; they do not authorize new bands.

---

## Where it's implemented

| Path | Role |
|---|---|
| [`packages/hardware-test/src/policyTx.ts`](../../packages/hardware-test/src/policyTx.ts) | DMK / Ethereum signer — `setGuardianPolicy` encode → Ledger sign → broadcast |
| [`packages/hardware-test/src/killSwitchTx.ts`](../../packages/hardware-test/src/killSwitchTx.ts) | Clear-sign `killSwitch()` |
| [`packages/hardware-test/`](../../packages/hardware-test/) | End-to-end USB demo app |
| [`clear-signing/`](../../clear-signing/) | ERC-7730 descriptors for OLED clear-signing |
| [`packages/keeper/src/ring.ts`](../../packages/keeper/src/ring.ts) | Decrypt / load Key Ring bag → `KeeperSecrets` |
| [`packages/keeper/src/enroll.ts`](../../packages/keeper/src/enroll.ts) | Ring enrollment flow |
| [`packages/keeper/src/capabilities.ts`](../../packages/keeper/src/capabilities.ts) | `mint` / `require` / `stampCapability` / `redactSecrets` |
| [`packages/keeper/src/paidTrigger.ts`](../../packages/keeper/src/paidTrigger.ts) | Requires `pay:trigger` / `pay:quote` capability before pay |
| [`packages/keeper/src/executor.ts`](../../packages/keeper/src/executor.ts) | `execute:policy:<id>` — **`secrets` required** (no skip-by-omission) |
| [`packages/keeper/src/agent/openrouter.ts`](../../packages/keeper/src/agent/openrouter.ts) | `redactSecrets` on tool outs / agent text before LLM/SSE |
| [`packages/keeper/src/agent/solver.ts`](../../packages/keeper/src/agent/solver.ts) | Explain-only tools; never receives session key fields |
| [`packages/web/`](../../packages/web/) | Policy draft UI → user confirms → device path (agents do not broadcast) |
| [`docs/LEDGER_DX_FEEDBACK.md`](../LEDGER_DX_FEEDBACK.md) | DX notes + proven tx |

---

## Proof artifacts

### 1 — Clear-sign policy tx (Base)

| Field | Value |
|---|---|
| Tx | [`0x89d9ce25007ed4ab4d2b5a0ed39a183c8dba2bd0b23e999059fcf0323098746b`](https://basescan.org/tx/0x89d9ce25007ed4ab4d2b5a0ed39a183c8dba2bd0b23e999059fcf0323098746b) |
| Recorded in | [`docs/LEDGER_DX_FEEDBACK.md`](../LEDGER_DX_FEEDBACK.md), root [`README.md`](../../README.md) |
| App path | `packages/hardware-test` |

Additional citations in [`docs/HACKATHON.md`](../HACKATHON.md):

- Policy: https://basescan.org/tx/0x6c249efd8f5dcec73b33fc6d155e24f7f53274f2fb167bf8f6eae6d7cc27a7a9  
- Kill: https://basescan.org/tx/0x6a93c38a2278ffa2fbbdc7dbc76c642c6702a5102ff45053faeef55978895b8b  

![Ledger OLED clear-sign](../assets/ledger-oled-policy.png)
<!-- REPLACE: photo/screenshot of Ledger OLED showing setGuardianPolicy clear-sign fields before approve -->

### 2 — Capability broker (scoped tokens, fail-closed)

Code: [`packages/keeper/src/capabilities.ts`](../../packages/keeper/src/capabilities.ts)

Smoke artifact: [`docs/proofs/phase-c2/c2-broker-smoke.out.txt`](../proofs/phase-c2/c2-broker-smoke.out.txt)

```text
redact true key=[REDACTED_SESSION] or=[REDACTED_OPENROUTER]
expired fail-closed …
missing fail-closed true capability required for pay:trigger …
PASS true
```

Write-up (honest hot-path notes): [`docs/proofs/phase-c2.md`](../proofs/phase-c2.md).

### 3 — Session key never enters LLM context

| Boundary | Evidence |
|---|---|
| Secrets type stays in keeper process | `KeeperSecrets` in [`ring.ts`](../../packages/keeper/src/ring.ts) — passed to tools as `ctx.secrets`, not serialized into chat prompts as raw key material |
| Redaction before model/SSE | [`openrouter.ts`](../../packages/keeper/src/agent/openrouter.ts) applies `redactSecrets` to tool `out` / `summary` / agent text |
| Broker public surface | `publicCapability` returns `{ id, scope, expiresAt }` only — [`capabilities.ts`](../../packages/keeper/src/capabilities.ts) |
| Solver tool allow-list | No pay/execute tools that echo keys — [`solver.ts`](../../packages/keeper/src/agent/solver.ts) |
| Audit statement | [`docs/AGENT_AUDIT.md`](../AGENT_AUDIT.md): “LLM never holds the session key in chat replies” |

### 4 — Key Ring / headless host

Enrollment docs: [`packages/keeper/README.md`](../../packages/keeper/README.md) § Key Ring · [`docs/LEDGER_DX_FEEDBACK.md`](../LEDGER_DX_FEEDBACK.md) § Capability broker demo.

**Captured Railway `/health` (2026-09-12):** [`docs/proofs/phase-c2/railway-health.json`](../proofs/phase-c2/railway-health.json)

```json
"keyRing": {
  "source": "env",
  "headless": false,
  "note": "env fallback — not Ledger prize ready"
}
```

[PROOF NEEDED: local or Railway `/health` JSON with `keyRing.source=ring`, `headless=true`, and `capabilityBroker.mode=ring-broker` after prize-clean enroll]

![Key Ring health](../assets/keyring-health.png)
<!-- REPLACE: terminal curl /health showing ring + headless=true (redact nothing sensitive beyond what’s already public) -->

### 5 — UI draft → device (agents don’t broadcast)

Journey documented in [`docs/AGENT_AUDIT.md`](../AGENT_AUDIT.md) § A. Draft a new policy.

![Policy draft → Confirm](../assets/policy-draft-ledger.png)
<!-- REPLACE: /protect/agent draft card + Confirm for Ledger clear-sign -->

---

## Track alignment

| Requirement (name) | How we satisfy it |
|---|---|
| **Key Ring CLI** — scoped secrets | `ring.ts` + `capabilities.ts`; Solver never sees raw keys |
| **Key Ring on headless host** | Design + README; **live Railway still env** — see proof #4 / limitations |
| **DMK + HITL** | `hardware-test` clear-sign — proof #1 |
| **x402 agent payments** (Ledger bullet) | Shared with Hedera — see [`HEDERA.md`](./HEDERA.md) |
| **DX feedback** | [`docs/LEDGER_DX_FEEDBACK.md`](../LEDGER_DX_FEEDBACK.md) |
| **ERC-7730 clear signing** | [`clear-signing/`](../../clear-signing/) |
| Start from Scratch | Net-new LGA — not Continuity |

Satisfies: **“device-backed trust / HITL before irreversible delegation”** — see proof #1.  
Satisfies: **“agent never holds raw API keys”** (broker + redact) — see proof #2–#3; Autopilot/`npm run pay` use **in-process capability stamps** (documented in C2), not a separate agent RPC.

---

## Honest limitations

1. **Railway not prize-clean on Key Ring** — captured health is `source=env` / `headless=false`. Do not claim headless production until proof #4 is filled.
2. **Hot-path capabilities** — `mintInternal: true` on CLI / Autopilot is a server-side TTL stamp, not a multi-party capability mint API ([`phase-c2.md`](../proofs/phase-c2.md) Limitations).
3. **Multiple GPM addresses** in docs / `.env.example` / hardware-test README (v1 `0x53C25a50…`, buy-dip `0xdBf463…`, example `0xd3EA42…`). Demo must pin one address matching the OLED clear-sign target.
4. **Kill switch** — code + cited Basescan exist; treat UX polish / v2 ABI mismatch on older contracts as operator risk ([`KillSwitchPanel.tsx`](../../packages/hardware-test/src/KillSwitchPanel.tsx) notes v2).
5. **ERC-7730 registry PR** — descriptors in-repo; [PROOF NEEDED: public registry PR URL if submitted].
6. **Balances in chat** — agents have no `getBalance` tool; holdings are Protect UI only ([`AGENT_AUDIT.md`](../AGENT_AUDIT.md)).
