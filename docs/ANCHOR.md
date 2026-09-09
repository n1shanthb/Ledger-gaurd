# LGA Anchor Document

> **Single source of truth** for Ledger Guardian Agent. All other docs, rules, and agent prompts derive from this file.
> Last updated: ETHOnline 2026 — three-track submission (Ledger · Graph · Hedera).

---

## Identity

| Field | Value |
|---|---|
| **Name** | Ledger Guardian Agent (LGA) |
| **Tagline** | Hardware-bounded delegation for autonomous DeFi exits |
| **Elevator pitch** | Users clear-sign LP stop-loss and take-profit bounds on a Ledger OLED. A keeper agent discovers policies via The Graph Receipt Graph, pays HBAR through x402 to attempt execution, and every fill is indexed as a compliance receipt. One Ledger tap kills all delegation. Keeper secrets live in Key Ring — never in `.env`. |
| **Event** | [ETHOnline 2026](https://ethglobal.com/events/ethonline2026) · Sep 4–16, 2026 |
| **Submission pool** | **Start from Scratch** (net-new) — Ledger + The Graph **AI Use Case** + **Composable** (dual Graph surfaces) |
| **Repo** | `ledgergaurd` (monorepo) |

**Full prize checklist:** [HACKATHON.md](./HACKATHON.md)

---

## Product Pillars (v2)

| Pillar | What it does | Sponsor |
|---|---|---|
| **LP / stop-loss exit** | Clear-sign “sell if price ≤ X” | Ledger |
| **Take-profit exit** | Clear-sign “sell at this rate for profit” | Ledger |
| **Buy-dip entry** | Clear-sign “spend USDC → buy ETH if price ≤ X” | Ledger |
| **Key Ring secrets** | Keeper session key + API creds via `wallet-cli ring` | Ledger |
| **x402 keeper gate** | `POST /trigger` requires HBAR via Blocky402 | Hedera + Ledger |
| **Kill switch** | Ledger-signed revoke all policies + session keys | Ledger |
| **Receipt Graph** | Live Subgraph — policies + compliance receipts | The Graph (AI Use Case) |
| **Subgraph MCP** | Keeper/agent queries policies in natural language | The Graph |
| **Messari fan-out** | One query → N protocols → risk/liquidity decision (`@lga/graph-data`) | The Graph (Composable) |

---

## Sponsor Tracks (official requirements)

### Ledger — AI Agents × Ledger (Start from Scratch) · $3,500

[ Prize page ](https://ethglobal.com/events/ethonline2026/prizes/ledger)

| Must demonstrate | LGA implementation |
|---|---|
| **Key Ring CLI** — scoped secrets, not raw keys in files | Keeper uses `wallet-cli ring` for session key, RPC, Blocky402 creds |
| **Key Ring on headless host** | Keeper on VPS/server; DMK only at user setup time |
| **DMK + HITL** | Clear-sign policy + kill switch on physical OLED |
| **x402 agent payments** | Shared `/trigger` endpoint (Hedera track) |
| **DX feedback doc** | `docs/LEDGER_DX_FEEDBACK.md` |

### The Graph — Best AI Use Case (From Scratch) · $5,000

Custom **Receipt Graph** is load-bearing for keeper decisions (policies → Pyth → execute). Subgraph MCP queries the same Studio endpoint.

### The Graph — Composable / Standardized · $5,000

**Standards leverage:** Messari Lending + DEX via `decideSafestBorrow` / `decideDeepestWethPool` / `evaluateSwapGate` (one document → N deployments → a call). Composed with Receipt Graph + Agent0 + Subgraph MCP. See `packages/graph-data` and console **Compose decisions**.

| Must demonstrate | LGA implementation |
|---|---|
| Graph as **load-bearing** live data source | Keeper automation from Receipt Graph |
| **Subgraph Studio** live data (no mocks) | Deploy `ledger-guardian-agent` on Base |
| **Meaningful automation** — decisions, not raw print | Trigger evaluation: policy params + Pyth → execute |
| **Subgraph MCP** | Keeper or demo agent queries via MCP |
| Messari / standardized one-query-N | `@lga/graph-data` decide + fan-out |
| Demo video 2–4 min | Unified submission video |

### Hedera — AI & Agentic Payments · $6,000 (3 × $2K)

| Must demonstrate | LGA implementation |
|---|---|
| **Live x402-gated service** on Hedera testnet/mainnet | `POST /trigger` returns 402 without payment |
| **Blocky402** facilitator | verify → settle flow |
| **≥1 real paid request** end-to-end | Agent pays HBAR → trigger → Base execution |
| README with payment flow architecture | `packages/keeper/README.md` |
| Demo video ≤ 5 min | Show 402 → pay → settle → execute |

---

## Network Topology (3 chains, 3 roles)

| Layer | Network | Role |
|---|---|---|
| **Smart contracts** | Base Mainnet (`8453`) | Policies, kill switch, Pyth verify, Uniswap execution |
| **Indexing** | The Graph on Base | **Receipt Graph** — policies + `ExecutionReceipt` compliance |
| **Micropayments** | Hedera testnet → mainnet | x402 gates keeper `/trigger` via Blocky402 |

Base execution and Hedera payment are **independent systems** linked by the keeper agent.

---

## Core Technical Claims

### TRUE — say these

- The **master private key never leaves the Ledger device**.
- **Key Ring CLI** holds keeper secrets — scoped capabilities, not exported keys.
- ERC-7730 renders **human-readable exit params** on the Ledger OLED.
- The Graph **Receipt Graph** indexes policies and compliance receipts (not real-time prices).
- **Subgraph MCP** lets the keeper agent query live policy state.
- Pyth provides **real-time price signals**; VAAs verified on-chain at execution.
- Hedera **x402** gates keeper API access — agent pays HBAR per trigger attempt.

### FALSE — never say these

| Wrong | Correct |
|---|---|
| "Cold storage assets untouched" | "Master key on device; trading assets in Guardian Vault smart account" |
| "The Graph real-time prices" | "Graph indexes policies and receipts; Pyth provides live prices" |
| "Mock subgraph for demo" | "Live Subgraph Studio — required for Graph prize" |

---

## System Components

```
packages/
├── web/              Series A protocol frontend (Next.js)
├── hardware-test/    DMK + Ledger clear-sign (live Base mainnet)
├── contracts/        GuardianPolicyManager, SessionKeyValidator, SwapExecutor
├── subgraph/         Receipt Graph → Subgraph Studio (Base)
├── keeper/           Subgraph MCP + Pyth + x402 /trigger + Key Ring secrets
└── clear-signing/    ERC-7730 descriptors
```

---

## Smart Contract Surface (target v2)

```solidity
enum PolicyType { STOP_LOSS, TAKE_PROFIT, LP_STOP_LOSS }

function setGuardianPolicy(
    address token, PolicyType policyType,
    uint256 stopLossPrice, uint256 takeProfitPrice,
    uint256 maxAmount, uint256 maxSlippageBps
) external;

function killSwitch() external;

function executePolicy(bytes32 policyId, bytes[] calldata priceUpdateData) external;

event ExecutionReceipt(...);  // indexed by Receipt Graph
```

**v1 live:** `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103` — 4-param stop-loss only.

---

## Consumer Journey

| Step | User / Agent | System |
|---|---|---|
| 0 | Bridge + deposit to Guardian Vault | Base |
| 1 | Clear-sign exit policy on Ledger | DMK + ERC-7730 → `setGuardianPolicy()` |
| 2 | Unplug Ledger | Key Ring holds keeper secrets on headless host |
| 3 | Keeper polls Receipt Graph | Subgraph Studio + optional Subgraph MCP |
| 4 | Price breach detected | Pyth spot vs stop-loss / take-profit |
| 5 | Agent pays x402 HBAR | Blocky402 → `POST /trigger` |
| 6 | Execution + receipt | Base tx → `ExecutionReceipt` → Graph |
| **Emergency** | Kill switch on Ledger | All policies revoked |

---

## Environment Variables

See [.env.example](../.env.example). **Keeper production secrets → Key Ring, not `.env`.**

---

## Hackathon Submission Checklist

See [HACKATHON.md](./HACKATHON.md) for full matrix.

- [x] Ledger DMK clear-sign → Base mainnet policy tx
- [x] Key Ring CLI for keeper secrets (`packages/keeper/src/ring.ts`)
- [x] Kill switch UI + `killSwitch()` in v2 contract
- [x] Receipt Graph package (Studio deploy after v2)
- [x] Subgraph MCP target in keeper `/health`
- [x] x402 `/trigger` + Blocky402 verify/settle (paid E2E still needs testnet HBAR)
- [x] Ledger DX feedback document
- [ ] Demo video (2–5 min)

---

## Doc Map

| Document | Purpose |
|---|---|
| [ANCHOR.md](./ANCHOR.md) | Canonical truth |
| [HACKATHON.md](./HACKATHON.md) | **Prize requirements → deliverables (all 3 tracks)** |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical deep dive |
| [SKILLS.md](./SKILLS.md) | SDK + agent skills |
| [LEDGER_DX_FEEDBACK.md](./LEDGER_DX_FEEDBACK.md) | Ledger prize DX doc |
