# ETHOnline 2026 — Sponsor Submission Requirements

> **Master checklist** mapping official prize requirements → LGA deliverables.
> Canonical product truth: [ANCHOR.md](./ANCHOR.md)

**Event pool:** Start from Scratch (net-new project) for Ledger and The Graph AI tracks.

---

## Three-track strategy (one demo, three stories)

```text
User clear-signs exit policy on Ledger (HITL)
        ↓
Receipt Graph indexes policies + ExecutionReceipts (The Graph — live Studio)
        ↓
Keeper agent polls via Subgraph MCP → evaluates Pyth price → decides trigger
        ↓
Agent pays HBAR via x402 → POST /trigger (Hedera + Blocky402)
        ↓
executePolicy() on Base → receipt indexed → compliance queryable
        ↓
Kill switch on Ledger → all delegation revoked
```

---

## 1. Ledger — AI Agents × Ledger (Start from Scratch)

**Prize pool:** $3,500 · [Official page](https://ethglobal.com/events/ethonline2026/prizes/ledger)

### What judges want (priority order)

| Priority | Requirement | LGA deliverable | Status |
|---|---|---|---|
| P0 | **Key Ring CLI** — secrets broker; agent never holds raw API keys | Keeper loads session key + RPC creds via `wallet-cli ring`, not `.env` | ⬜ |
| P0 | **Key Ring on headless host** — VPS/keeper with no USB | Keeper runs on server; only setup uses DMK + device | ⬜ |
| P0 | **DMK hardware signing** — device-backed trust | `packages/hardware-test` — live Base mainnet policy tx | ✅ |
| P0 | **HITL** — Ledger approves before irreversible delegation | Clear-sign `setGuardianPolicy` + `killSwitch` on OLED | 🟡 policy ✅ / kill ⬜ |
| P1 | **x402 payment flows** (Ledger prize bullet) | Keeper `/trigger` gated by HBAR (shared with Hedera track) | ⬜ |
| P1 | **ERC-7730 clear signing** | `clear-signing/*.erc7730.json` + registry PR | 🟡 |
| P1 | **DX feedback document** | `docs/LEDGER_DX_FEEDBACK.md` with screenshots + gaps | ⬜ |
| P2 | Agent Stack usage (DMK + Wallet CLI / Key Ring) | README + demo shows both | 🟡 DMK only |

### Demo video must show

1. Physical Ledger OLED — policy params (stop-loss / take-profit) before approve
2. Kill switch — one tap revokes all policies
3. Keeper secrets from Key Ring — not visible in repo / `.env`
4. Why device-backed trust matters for autonomous DeFi

### Do NOT submit as

- Continuity track (user verified: **Start from Scratch**)
- Generic chatbot wrapper
- Ledger branding only without DMK/Key Ring integration

---

## 2. The Graph — Best AI Use Case (From Scratch)

**Prize pool:** $5,000 · **NOT** the Composable/Standardized track · [Graph prizes](https://ethglobal.com/events/ethonline2026/prizes)

**Correct track:** 🤖 Best AI Tooling or AI Use Case with The Graph **(From Scratch)** — Start Fresh pool.

### Qualification requirements → LGA mapping

| Requirement | LGA deliverable | Status |
|---|---|---|
| Graph is **load-bearing** — agent uses Graph as live blockchain data source | Keeper **automation** driven by Receipt Graph (policies + receipts), not a static UI | ⬜ |
| **Live data** from Subgraph Studio (no mocks) | Deploy `ledger-guardian-agent` subgraph to Studio; keeper uses API key | ⬜ |
| **Meaningful work** — reasoning, decisions, automation | Keeper: query active policies → compare Pyth → decide STOP_LOSS vs TAKE_PROFIT → execute | ⬜ |
| **Subgraph MCP** in keeper/agent flow | Keeper agent queries policies via [Subgraph MCP](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/) | ⬜ |
| Public repo + README/SKILL | `packages/subgraph/README.md` + root README | ⬜ |
| Demo video **2–4 minutes** | One clip covering Graph + Ledger + Hedera | ⬜ |
| Start Fresh pool | Net-new project built during event | ✅ |

### Receipt Graph (our differentiator)

Not “print a GraphQL result.” The keeper **decides** using indexed data:

```graphql
# Keeper poll: active policies needing evaluation
{ policies(where: { active: true }) { id stopLossPrice takeProfitPrice token } }

# Post-execution: compliance audit
{ executionReceipts(orderBy: timestamp, orderDirection: desc, first: 5) {
    triggerType pythPrice executionPrice compliant txHash
}}
```

**Subgraph entities:** `Policy`, `ExecutionReceipt`, `KillSwitch`

### Does NOT qualify (avoid)

- Mocked / local-only subgraph data
- Single query with no automation
- Composable/Messari standardized subgraph track (different prize — we are **AI Use Case**)

### Optional extra credit

- Natural-language policy status via Subgraph MCP in demo
- x402 pay-per-query for receipt API (ties Hedera + Graph)

---

## 3. Hedera — AI & Agentic Payments

**Prize pool:** $6,000 (up to 3 × $2,000) · [Hedera prizes](https://ethglobal.com/events/ethonline2026/prizes)

**Track:** 🤖 AI & Agentic Payments on Hedera

### Qualification requirements → LGA mapping

| Requirement | LGA deliverable | Status |
|---|---|---|
| **Live x402-gated service** on Hedera testnet or mainnet | `POST /trigger` on keeper — returns 402 without payment | ⬜ |
| Settled through **Blocky402** facilitator | `POST /verify` → `POST /settle` via Blocky402 testnet | ⬜ |
| **Platform/agent consumes** service with ≥1 **real paid request** E2E | Keeper client (or script) pays HBAR → trigger → Base execution attempt | ⬜ |
| Public GitHub + README (setup, architecture, payment flow) | `packages/keeper/README.md` | ⬜ |
| Demo video **≤ 5 minutes** showing paid request | Show 402 → pay → settle → trigger fires | ⬜ |

### Our x402 service design

```text
Service:  LGA Keeper API — "paid execution attempt for hardware-bounded policy"
Endpoint: POST /trigger
Price:    ~0.001 HBAR (100,000 tinybars) per attempt
Network:  hedera:testnet (demo) → mainnet optional
Facilitator: https://api.testnet.blocky402.com
Consumer:   Keeper agent or CLI script using @x402/hedera
```

**What is being sold:** one evaluated trigger attempt (Pyth check + optional Base tx), not the Base gas itself.

### Extra points (target)

| Extra | LGA approach |
|---|---|
| Metered compute / data | Price per trigger evaluation, not flat subscription |
| Verifiable payment audit trail | Log x402 settlement tx + link to `ExecutionReceipt` in Receipt Graph |
| ERC-8004 / HCS-14 agent identity | Optional: register keeper agent ID (post-MVP) |
| HTS token settlement | Start with HBAR; document HTS path in README |

### Reference

- [x402 inference PoC](https://github.com/hedera-dev/x402-inference-pay-per-request-poc)
- [Blocky402 quickstart](https://blocky402.com/docs/quickstart/)
- [Hedera x402 blog](https://hedera.com/blog/hedera-and-the-x402-payment-standard/)

---

## Unified deliverable checklist

### Code (must ship)

- [x] `packages/hardware-test` — DMK + clear-sign policy + kill switch UI
- [x] `packages/contracts` v2 — take-profit, kill switch, `ExecutionReceipt` (redeploy to Base)
- [x] `packages/subgraph` — Receipt Graph (Studio deploy after v2 address)
- [x] `packages/keeper` — Subgraph poll + Pyth + **x402 `/trigger`** + Key Ring `ring.ts`
- [x] **Key Ring** — `wallet-cli ring get` in keeper (`packages/keeper/src/ring.ts`)
- [x] Subgraph MCP — keeper `/health` + `/policies` expose Studio URL as MCP target

### Docs (must ship)

- [x] `docs/ANCHOR.md`, `docs/ARCHITECTURE.md`, `docs/HACKATHON.md`
- [x] `packages/keeper/README.md` — x402 payment flow diagram
- [x] `packages/subgraph/README.md` — Studio deploy + example queries
- [x] `docs/LEDGER_DX_FEEDBACK.md` — Ledger DX feedback

### Demo video (2–4 min Graph / ≤5 min Hedera — one edit OK)

| Scene | Track |
|---|---|
| Connect Ledger Account 2, clear-sign policy on OLED | Ledger |
| Basescan policy tx | Ledger + Graph (source event) |
| Graph Studio — live subgraph syncing | Graph |
| Keeper MCP/query → "policy X active, stop-loss $2800" | Graph |
| POST /trigger → 402 → pay HBAR → settle → execute | Hedera |
| Receipt Graph — `compliant: true` | Graph |
| Kill switch on Ledger → policies inactive | Ledger |

### Live URLs to include in submission

| Resource | URL |
|---|---|
| Subgraph Studio | `https://api.studio.thegraph.com/query/.../ledger-guardian-agent/...` |
| Keeper API | `https://your-keeper.example.com/trigger` (or ngrok for demo) |
| Contract | `https://basescan.org/address/0x53C25a50B2f40EF8bFD3d673ec667cCB912af103` |
| Example policy tx | `https://basescan.org/tx/0x89d9ce25...` |

---

## Build order (critical path)

```text
Week 1
  1. packages/subgraph → deploy Studio (unblocks Graph track)
  2. packages/keeper → x402 /trigger + Blocky402 (unblocks Hedera track)
  3. wallet-cli ring → keeper secrets (unblocks Ledger track)

Week 2
  4. Contract v2 → ExecutionReceipt + killSwitch → reindex subgraph
  5. Subgraph MCP in keeper demo
  6. DX feedback doc + demo video
```

---

## Prize pool summary

| Sponsor | Track | Pool | Our angle |
|---|---|---|---|
| Ledger | AI Agents × Ledger (Start from Scratch) | $3,500 | DMK HITL + Key Ring + kill switch |
| The Graph | Best AI Use Case (From Scratch) | $5,000 | Receipt Graph + Subgraph MCP + keeper automation |
| Hedera | AI & Agentic Payments | $6,000 | x402-gated `/trigger` via Blocky402 |

**Total addressable:** $14,500 across three tracks with one integrated demo.
