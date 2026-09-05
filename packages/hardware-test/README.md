# LGA Hardware Test

Ledger DMK WebHID demo + **ERC-7730 clear-sign** for guardian exit policies on Base.

## Run

```bash
cd packages/hardware-test
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:5173** in **Chrome or Edge**.

## Tabs

| Tab | Purpose |
|---|---|
| **Set Policy** | Clear-sign `setGuardianPolicy()` (v2: type + stop + take-profit) → Base |
| **Kill Switch** | Clear-sign `killSwitch()` — revokes all policies + session keys |
| **Hello Test** | Message signing sanity check (no on-chain tx) |

## Policy fields

| Field | Purpose |
|---|---|
| Policy type | Stop-loss / Take-profit / LP stop-loss |
| Stop-loss floor | Sell when price ≤ this (Pyth 1e8 USD) |
| Take-profit target | Sell when price ≥ this |
| Max amount / slippage | Bounded execution caps |

**v1 contract (live):** 4-param stop-loss only @ `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103`.  
**v2:** deploy via `packages/contracts` then paste the new address here.

## Kill switch

Dedicated tab → OLED “Revoke ALL guardian policies and disable keeper access” → `killSwitch()`.

## Account safety

- Default: **Account 2** (`m/44'/60'/0'/0/1`) — use a test account, not main holdings
- Fund Account 2 with ~$2–5 Base ETH for gas only

## Env

```env
VITE_GUARDIAN_POLICY_MANAGER_ADDRESS=0x53C25a50B2f40EF8bFD3d673ec667cCB912af103
VITE_BASE_RPC_URL=https://mainnet.base.org
```

## ERC-7730 OLED labels

Descriptors:

- `clear-signing/guardian_policy.erc7730.json` — exit policy params
- `clear-signing/kill_switch.erc7730.json` — emergency revoke

Human-readable fields appear after registry PR merge; until then the Ethereum app may show raw calldata.

## Proven flow

Ledger Account 2 → clear-sign → [Basescan tx](https://basescan.org/tx/0x89d9ce25007ed4ab4d2b5a0ed39a183c8dba2bd0b23e999059fcf0323098746b)
