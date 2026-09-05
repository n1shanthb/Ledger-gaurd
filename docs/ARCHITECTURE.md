# LGA Architecture

> Deep technical architecture for Ledger Guardian Agent.
> Canonical truths live in [ANCHOR.md](./ANCHOR.md).

---

## 1. Problem & Solution

### Problem

LP providers and DeFi users face a trade-off:

1. **Cold storage (Ledger)** — secure, but static; no automated exit when price moves.
2. **Hot wallets / session keys** — 24/7 automation, but no hardware veto and weak audit trail.

### Solution

LGA is a **hardware-bounded delegation layer** for autonomous DeFi exits:

- User **clear-signs** stop-loss floor, take-profit target, and slippage caps on Ledger OLED (ERC-7730).
- Policy is enforced by an **ERC-7579 Guardian Vault** on Base.
- A **keeper bot** monitors Pyth prices; execution attempts are **x402-gated** (HBAR per trigger).
- Every execution emits an **ExecutionReceipt** indexed by The Graph for compliance audit.
- **Kill switch** — one Ledger-signed tx revokes all delegation instantly.

---

## 2. High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SETUP (User + Ledger)                           │
│  [LGA App] ──WebHID/DMK──► [Ledger Device]                              │
│       │                              │                                  │
│       │    ERC-7730 Clear Sign       │ physical button                  │
│       └──────────────────────────────┴──► setGuardianPolicy() on Base  │
│                                           killSwitch() on emergency      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GUARDIAN VAULT (Base Mainnet)                        │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐   │
│  │ GuardianPolicy   │  │ SessionKeyValidator │  │ SwapExecutor     │   │
│  │ Manager          │  │ (ERC-7579 IValidator)│  │ (ERC-7579 IExec) │   │
│  └──────────────────┘  └─────────────────────┘  └────────┬─────────┘   │
│         │ emits ExecutionReceipt                          │             │
│                                              Uniswap v3 SwapRouter02    │
└─────────────────────────────────────────────────────────────────────────┘
         │ policies + receipts                    ▲
         ▼                                         │
┌─────────────────────────┐   poll          ┌─────┴────────────────────────┐
│ The Graph               │◄────────────────│ Keeper Bot                     │
│ · Policy registry       │                 │  · Subgraph GraphQL            │
│ · ExecutionReceipt graph│                 │  · Pyth Hermes (live price)    │
│ · KillSwitch events     │                 │  · x402 POST /trigger          │
└─────────────────────────┘                 └──────────────┬───────────────┘
                                                             │
┌─────────────────┐    HBAR micropay                         │
│ Hedera x402     │◄─────────────────────────────────────────┘
│ Blocky402       │
└─────────────────┘
```

---

## 3. Package Layout

```
ledgergaurd/
├── packages/
│   ├── hardware-test/          # Vite + DMK — live Ledger demo (Base mainnet)
│   ├── web/                    # Next.js 15 (planned production UI)
│   ├── contracts/              # Foundry
│   │   ├── src/
│   │   │   ├── GuardianPolicyManager.sol
│   │   │   ├── SessionKeyValidator.sol
│   │   │   └── SwapExecutor.sol
│   │   ├── test/
│   │   └── script/Deploy.s.sol
│   ├── subgraph/               # The Graph — Receipt Graph
│   │   ├── schema.graphql
│   │   ├── subgraph.yaml
│   │   └── src/mapping.ts
│   └── keeper/                 # Node.js / TypeScript
│       ├── src/
│       │   ├── index.ts        # Express + x402 middleware
│       │   ├── subgraph.ts     # policy + receipt poll
│       │   ├── pyth.ts         # price fetch + VAA
│       │   └── executor.ts     # executePolicy calldata
│       └── package.json
├── clear-signing/
│   ├── guardian_policy.erc7730.json
│   └── kill_switch.erc7730.json   # planned
└── docs/
```

---

## 4. Component Specifications

### 4.1 Frontend — Ledger DMK + Key Ring setup

**Current:** `packages/hardware-test` (Vite + React + DMK + viem)  
**Target:** `packages/web` (Next.js + Wagmi)

| Concern | Implementation |
|---|---|
| Hardware connect | Singleton DMK + `webHidTransportFactory` |
| Account picker | Derivation index 0–4; default Account 2 for testing |
| Policy form | token, policyType, stopLossPrice, takeProfitPrice, maxAmount, maxSlippageBps |
| Kill switch | Dedicated button → `killSwitch()` clear-sign on Ledger |
| Key Ring setup | One-time: `wallet-cli ring init` + enroll keeper secrets |
| Chain | Base (`8453`) |

**Ledger Start from Scratch:** User uses DMK at setup; keeper runs headless with Key Ring secrets.

### 4.2 ERC-7730 Clear Signing

**Files:** `clear-signing/guardian_policy.erc7730.json`, `clear-signing/kill_switch.erc7730.json`

| Param | OLED label | Format |
|---|---|---|
| `token` | Protected Asset | `addressName` |
| `policyType` | Policy Type | enum label (Stop-Loss / Take-Profit / LP Stop-Loss) |
| `stopLossPrice` | Stop-Loss Floor | `amount` (8 decimals, `$` prefix) |
| `takeProfitPrice` | Take-Profit Target | `amount` (8 decimals, `$` prefix) |
| `maxAmount` | Max Trade Amount | `tokenAmount` |
| `maxSlippageBps` | Max Slippage | `percentage` |

**Kill switch OLED:** `"Revoke ALL guardian policies and disable keeper access"`

### 4.3 Smart Contracts (Foundry, Solidity 0.8.24+)

#### GuardianPolicyManager

- Stores policies keyed by `policyId = keccak256(chainId, contract, owner, token, nonce)`.
- Emits `PolicyCreated`, `PolicyRevoked`, `KillSwitchActivated`, `ExecutionReceipt`.
- `executePolicy()` verifies Pyth VAA, checks stop-loss **or** take-profit condition, swaps via SwapExecutor, emits receipt with compliance fields.

**Trigger logic:**

```
IF pythPrice <= stopLossPrice AND stopLossPrice > 0 → trigger STOP_LOSS
IF pythPrice >= takeProfitPrice AND takeProfitPrice > 0 → trigger TAKE_PROFIT
```

#### SessionKeyValidator (ERC-7579 IValidator)

- Validates session key signatures against stored policy bounds.
- Disabled globally when owner calls `killSwitch()`.

#### SwapExecutor (ERC-7579 IExecutor)

- Calls Uniswap v3 `SwapRouter02.exactInputSingle()`.
- Enforces `maxSlippageBps` via `amountOutMinimum`.
- Records actual slippage for `ExecutionReceipt.compliant`.

#### Pyth integration

```solidity
IPyth(pythBase).parsePriceFeedUpdates(priceUpdateData, priceIds, minPublishTime, maxPublishTime);
```

- Base Pyth: `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a`
- `maxStaleness`: 60 seconds recommended
- **Never cache VAAs** — fetch inline at execution

### 4.4 The Graph — Receipt Graph (Base)

**Network:** `base` in `subgraph.yaml`

#### schema.graphql

```graphql
enum PolicyType { STOP_LOSS TAKE_PROFIT LP_STOP_LOSS }
enum TriggerType { STOP_LOSS TAKE_PROFIT }

type Policy @entity {
  id: Bytes!
  owner: Bytes!
  token: Bytes!
  policyType: PolicyType!
  stopLossPrice: BigInt!
  takeProfitPrice: BigInt!
  maxAmount: BigInt!
  maxSlippageBps: BigInt!
  active: Boolean!
  receipts: [ExecutionReceipt!]! @derivedFrom(field: "policy")
  createdAt: BigInt!
  revokedAt: BigInt
}

type ExecutionReceipt @entity {
  id: Bytes!                    # receiptId
  policy: Policy!
  owner: Bytes!
  triggerType: TriggerType!
  pythPrice: BigInt!
  executionPrice: BigInt!
  maxSlippageBps: BigInt!
  actualSlippageBps: BigInt!
  compliant: Boolean!
  txHash: Bytes!
  timestamp: BigInt!
}

type KillSwitch @entity {
  id: Bytes!                    # txHash
  owner: Bytes!
  policiesRevoked: BigInt!
  timestamp: BigInt!
}
```

**Usage boundary:**

| Receipt Graph IS for | Receipt Graph is NOT for |
|---|---|
| Policy discovery | Real-time price triggers |
| Compliance audit trail | Sub-second execution decisions |
| Demo: "was execution within signed bounds?" | Pyth VAA sourcing |
| Kill switch history | |

**Example GraphQL query (demo):**

```graphql
query ReceiptCompliance($policyId: Bytes!) {
  executionReceipts(where: { policy: $policyId }, orderBy: timestamp, orderDirection: desc) {
    triggerType
    pythPrice
    executionPrice
    maxSlippageBps
    actualSlippageBps
    compliant
    txHash
  }
}
```

Keeper polls subgraph every **30 seconds**. Pyth is fetched **inline at execution time**.

### 4.4b Subgraph MCP (Graph AI track requirement)

The keeper agent queries live policy state via [Subgraph MCP](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/):

```text
Agent prompt: "Which active policies have stop-loss below current ETH price?"
→ MCP → GraphQL → Receipt Graph on Subgraph Studio
→ Keeper decides whether to initiate x402-paid /trigger
```

**Qualification:** Graph is load-bearing — automation and decisions, not printing raw JSON in a UI.

### 4.5 Keeper Bot + Key Ring + Hedera x402

**Stack:** Node.js, Express, `@x402/core`, `@x402/hedera`, `@hashgraph/sdk`, `wallet-cli ring`

#### Key Ring (Ledger track)

```bash
wallet-cli ring init --name lga-keeper-host   # USB once
# fill secrets.env from secrets.env.example
WALLET_PASS=… npm run ring:enroll            # → secrets.env.enc
# headless: WALLET_PASS=… npm start           # decrypt, no USB
```

Keeper decrypts `secrets.env.enc` at runtime — **no secrets in git or plaintext `.env`**.

#### x402 service (Hedera track — hosted service)

#### Endpoint flow

| Field | Value |
|---|---|
| Service | LGA Keeper — paid policy trigger evaluation |
| Endpoint | `POST /trigger` |
| Network | `hedera:testnet` (demo) |
| Facilitator | `https://api.testnet.blocky402.com` |
| Price | ~100,000 tinybars (0.001 HBAR) per attempt |

```text
POST /trigger
  │
  ├─ (no payment) ──► 402 Payment Required
  │                      paymentRequirements: { network: hedera:testnet, amount: 100000 tinybars }
  │
  ├─ (with x402 payload) ──► Blocky402 POST /verify → POST /settle
  │
  └─ (settled) ──► fetch Pyth VAA → executePolicy() on Base via Key Ring session key
                   → ExecutionReceipt emitted → Receipt Graph indexes
```

#### Trigger evaluation (keeper)

```
FOR each active policy from subgraph:
  spot = Pyth Hermes price (token/USD)
  IF spot <= policy.stopLossPrice → candidate STOP_LOSS
  IF spot >= policy.takeProfitPrice → candidate TAKE_PROFIT
  IF candidate → require x402 payment → execute
```

---

## 5. Data Flow — Execution Sequence

```
1. Keeper polls Receipt Graph → active policies
2. Keeper fetches Pyth spot price for token/USD feed
3. IF stop-loss OR take-profit condition met:
   a. Client/agent pays x402 fee (HBAR) to POST /trigger
   b. Keeper fetches fresh Pyth VAA (not cached)
   c. Keeper builds executePolicy(policyId, priceUpdateData) calldata
   d. Session key signs and submits tx to Base
   e. GuardianPolicyManager verifies VAA on-chain
   f. SwapExecutor swaps token → stablecoin via Uniswap v3
   g. ExecutionReceipt emitted (pythPrice, executionPrice, compliant)
   h. Receipt Graph indexes receipt within ~1–5 min
```

### Kill switch sequence

```
1. User clicks Kill Switch in UI
2. Ledger clear-signs killSwitch() on OLED
3. Contract revokes all owner policies + disables session keys
4. KillSwitchActivated event → Receipt Graph
5. Subsequent keeper /trigger calls find no active policies → no execution
```

---

## 6. Security Model

| Asset | Location | Risk |
|---|---|---|
| Master seed / private key | Ledger device only | Never exported |
| Keeper session key + API creds | **Key Ring CLI** (scoped) | Not in repo / `.env` |
| Trading funds | Guardian Vault (Base) | Bounded by policy |
| Keeper API | Public internet | x402 — HBAR per `/trigger` |

**Maximum loss:** Vault balance, capped further by `maxAmount` per execution. Kill switch stops future execution.

---

## 7. Deployment Checklist

See [HACKATHON.md](./HACKATHON.md) for full three-track matrix.

| Step | Command / Action | Track |
|---|---|---|
| Deploy Receipt Graph | `graph deploy --studio ledger-guardian-agent` | Graph |
| Configure Subgraph MCP | Point MCP at Studio query URL | Graph |
| Start keeper + x402 | `pnpm --filter keeper start` | Hedera |
| Verify paid request | `@x402/hedera` client → `/trigger` E2E | Hedera |
| Key Ring secrets | `wallet-cli ring` — no `.env` secrets in prod | Ledger |
| Deploy contracts v2 | kill switch + ExecutionReceipt | All |
| Ledger DX doc | `docs/LEDGER_DX_FEEDBACK.md` | Ledger |
| Demo video | 2–5 min unified clip | All |

---

## 8. Known Limitations (honest)

1. **Assets must be in the Guardian Vault** — not in the Ledger EOA. User must bridge + deposit.
2. **Subgraph lag** — 1–5 min; not suitable as price oracle.
3. **v1 contract live** — current deploy supports stop-loss only (4-param API); v2 adds take-profit, kill switch, receipts.
4. **Keeper liveness** — if keeper goes offline, policies won't execute until it returns.
5. **Single DEX** — v1 uses Uniswap v3 on Base only.

---

## 9. Future Extensions (post-hackathon)

- Uniswap v3 LP range rebalance policies (tick bounds on OLED)
- Policy expiry + hardware refresh loop
- ERC-8004 agent identity for keeper discovery
- Additional DEX routers (Aerodrome, 0x)
