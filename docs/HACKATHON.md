# ETHOnline 2026 — Sponsor Submission Requirements

> **Master checklist** mapping official prize requirements → LGA deliverables.
> Canonical product truth: [ANCHOR.md](./ANCHOR.md)

**Event pool:** **Start Fresh** / Start from Scratch (net-new project) for Ledger and The Graph AI tracks — not Continuity.

---

## Three-track strategy (one demo, three stories)

```text
User clear-signs exit policy on Ledger (HITL)
        ↓
Receipt Graph indexes policies + ExecutionReceipts (The Graph — live Studio)
        ↓
Keeper agent (Clerk / Solver) evaluates Pyth + Messari gate
        ↓
HOST:  POST /trigger returns 402 unpaid (Blocky402 / Hedera)
CONSUMER: Payer / Autopilot / npm run pay → HBAR settle → execute attempt
        ↓
executePolicy() on Base → receipt indexed → compliance queryable
        ↓
Kill switch on Ledger → all delegation revoked
```

**Hedera host+consumer:** the same keeper process **hosts** gated `/trigger` and **pays** as the x402 consumer. Graph prize = AI **Use Case** agent/app (Receipt Graph load-bearing), not tooling.

---

## 1. Ledger — AI Agents × Ledger (Start from Scratch)

**Prize pool:** $3,500 · [Official page](https://ethglobal.com/events/ethonline2026/prizes/ledger)

### What judges want (priority order)

| Priority | Requirement | LGA deliverable | Status |
|---|---|---|---|
| P0 | **Key Ring CLI** — secrets broker; agent never holds raw API keys | `capabilities.ts` mints scoped TTLs; Solver never sees session/OpenRouter keys | ✅ |
| P0 | **Key Ring on headless host** — VPS/keeper with no USB | `ring init` once with device; runtime = `WALLET_PASS` + network only | ✅ |
| P0 | **DMK hardware signing** — device-backed trust | `packages/hardware-test` — live Base mainnet policy tx | ✅ |
| P0 | **HITL** — Ledger approves before irreversible delegation | Clear-sign `setGuardianPolicy` + `killSwitch` on OLED | 🟡 policy ✅ / kill ⬜ |
| P1 | **x402 payment flows** (Ledger prize bullet) | Keeper `/trigger` gated by HBAR; `POLL_MS=0` + pay-on-hit | 🟡 |
| P1 | **OpenRouter agent** via Key Ring | `POST /agent/chat` tools → Graph + paid trigger | 🟡 |
| P1 | **ERC-7730 clear signing** | `clear-signing/*.erc7730.json` + registry PR | 🟡 |
| P1 | **DX feedback document** | `docs/LEDGER_DX_FEEDBACK.md` (+ C2 broker section); screenshots still thin | 🟡 |
| P2 | Agent Stack usage (DMK + Wallet CLI / Key Ring) | DMK hardware-test + `wallet-cli ring` enroll/decrypt on keeper | ✅ |

### Demo video must show

1. Physical Ledger OLED — policy params (stop-loss / take-profit) before approve
2. Kill switch — one tap revokes all policies
3. Keeper secrets from Key Ring — `secrets.env.enc` + `/health.keyRing.headless=true` (no USB)
4. Why device-backed trust matters for autonomous DeFi

### Do NOT submit as

- Continuity track (user verified: **Start from Scratch**)
- Generic chatbot wrapper
- Ledger branding only without DMK/Key Ring integration

---

## 2. The Graph — dual prize surfaces

**AI Use Case (From Scratch)** · $5,000 · Receipt Graph + keeper automation + Subgraph MCP  
**Composable / Standardized** · $5,000 · Messari decisions + Gateway + Agent0 + ComposeProof  

Select **both** Graph partner prizes on the ETHGlobal form when both bars are met.  
[Graph prizes](https://ethglobal.com/events/ethonline2026/prizes)

### 2a. Best AI Use Case (From Scratch)

**Correct track:** 🤖 Best AI Tooling or AI Use Case with The Graph **(From Scratch)** — Start Fresh pool.

### Qualification requirements → LGA mapping

| Requirement | LGA deliverable | Status |
|---|---|---|
| Graph is **load-bearing** — agent uses Graph as live blockchain data source | Keeper **automation** driven by Receipt Graph (policies + receipts), not a static UI | 🟡 live Studio + `/policies` |
| **Live data** from Subgraph Studio (no mocks) | `ledger-guardian-agent` v0.0.4 on Base — query URL below | ✅ |
| **Meaningful work** — reasoning, decisions, automation | Keeper: query active policies → compare Pyth → decide STOP_LOSS vs TAKE_PROFIT → execute | 🟡 code ready; need active policy for fill |
| **Subgraph MCP** in keeper/agent flow | `/health` + `/policies` expose Studio URL as MCP target | ✅ |
| Public repo + README/SKILL | `packages/subgraph/README.md` + root README | ✅ |
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

**Subgraph entities:** `Policy`, `ExecutionReceipt`, `KillSwitch`, `PaymentAudit`

### Does NOT qualify for AI Use Case (avoid)

- Mocked / local-only subgraph data
- Single query with no automation

### 2b. Best Use of Composable or Standardized Graph Products

| Requirement | LGA deliverable | Status |
|---|---|---|
| Standardized schema / Messari | `@lga/graph-data` — one lending + one DEX document fan-out | ✅ |
| One query → many protocols | Base Aave V3 + Seamless + Compound V3; Uniswap V3 multi-deployment | ✅ |
| Compose ≥2 Graph products | Messari Gateway + Receipt Graph Studio + Agent0 + Subgraph MCP | ✅ |
| Live Gateway / Studio (no mocks) | `NEXT_PUBLIC_GRAPH_API_KEY` + Studio URL | 🟡 needs key in env |
| Standards leverage visible | Console **Compose decisions** + MCP decision prompts | ✅ |

Package: `packages/graph-data`. Docs: [SUBGRAPH_MCP.md](./SUBGRAPH_MCP.md).

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
| **Live x402-gated service** on Hedera testnet or mainnet | `POST /trigger` on keeper — returns 402 without payment | ✅ see `docs/proofs/x402-settle.md` |
| Settled through **Blocky402** facilitator | `POST /verify` → `POST /settle` via Blocky402 testnet | ✅ |
| **Platform/agent consumes** service with ≥1 **real paid request** E2E | Keeper Payer / CLI `npm run pay` pays HBAR → trigger | ✅ |
| Public GitHub + README (setup, architecture, payment flow) | `packages/keeper/README.md` host+consumer diagram | ✅ |
| Demo video **≤ 5 minutes** showing paid request | Show 402 → pay → settle → trigger fires | ⬜ |

### Our x402 service design

```text
Service:  LGA Keeper API — "paid execution attempt for hardware-bounded policy"
Endpoint: POST /trigger   ← HOST (x402-gated)
Price:    ~0.001 HBAR (100,000 tinybars) per attempt
Network:  hedera:testnet (demo) → mainnet optional
Facilitator: https://api.testnet.blocky402.com
Consumer:   Payer agent · Autopilot pay-on-hit · CLI `npm run pay` (@x402/hedera)
```

**What is being sold:** one evaluated trigger attempt (Pyth check + optional Base tx), not the Base gas itself.

### Extra points (target)

| Extra | LGA approach |
|---|---|
| Metered compute / data | Price per trigger evaluation, not flat subscription |
| Verifiable payment audit trail | HCS memo + Base `PaymentAudit` → Receipt Graph (`hcsRef` / `hederaPaymentRef`) ✅ |
| ERC-8004 / HCS-14 agent identity | Light HCS roster + `x-lga-agent` stamps (not full ERC-8004 registry) ✅ |
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
- [x] `docs/LEDGER_DX_FEEDBACK.md` — Ledger DX feedback (screenshots still thin → table P1 🟡)

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
| Subgraph Studio | https://thegraph.com/studio/subgraph/ledger-guardian-agent |
| Query URL | https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4 |
| Keeper API | Public Railway URL + local `http://127.0.0.1:3001` — **`POLL_MS=0` prize mode** |
| Contract (GPM buy-dip) | https://basescan.org/address/0xdBf463E260573797Dd1a03B4f45876aad777453b |
| x402 settle proof | [docs/proofs/x402-settle.md](./proofs/x402-settle.md) |
| Subgraph MCP | [docs/SUBGRAPH_MCP.md](./SUBGRAPH_MCP.md) |
| Example policy tx | https://basescan.org/tx/0x6c249efd8f5dcec73b33fc6d155e24f7f53274f2fb167bf8f6eae6d7cc27a7a9 |
| Kill switch tx | https://basescan.org/tx/0x6a93c38a2278ffa2fbbdc7dbc76c642c6702a5102ff45053faeef55978895b8b |

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
| The Graph | Composable / Standardized | $5,000 | Messari decisions + Agent0 + ComposeProof |
| Hedera | AI & Agentic Payments | $6,000 | x402-gated `/trigger` via Blocky402 |

**Total addressable:** $14,500 across three tracks with one integrated demo.
