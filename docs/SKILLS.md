# LGA Skills & SDK Reference

> External agent skills, CLI tools, and SDK packages for building Ledger Guardian Agent.
> Canonical project context: [ANCHOR.md](./ANCHOR.md)

**v2 product · ETHOnline 2026 three-track submission:** Ledger (Key Ring + DMK) · Graph (Receipt Graph + MCP) · Hedera (x402 Blocky402).

See [HACKATHON.md](./HACKATHON.md) for prize requirements matrix.

---

## Quick Install (Day 1)

```bash
# Ledger agent skills (SDK setup)
npx skills add ledgerhq/agent-skills

# Graph subgraph skills
npx skills add graphprotocol/subgraphs-skills

# Hedera skills
npx skills add hedera-dev/hedera-skills

# Wallet CLI (optional — terminal-driven Ledger ops)
npm i -g @ledgerhq/wallet-cli
```

---

## 1. Ledger Stack

### Agent Skills

| Skill | Install | Use when |
|---|---|---|
| Ledger Agent Skills | `npx skills add ledgerhq/agent-skills` | Wiring DMK, clear signing, wallet integration |
| DMK Skills | Included in agent-skills repo | "Add Ledger Ethereum signing to my React app" |

**Docs:** [developers.ledger.com](https://developers.ledger.com/)

### SDK Packages

| Package | Purpose |
|---|---|
| `@ledgerhq/device-management-kit` | Core DMK — session management, device discovery |
| `@ledgerhq/device-management-kit-transport-webhid` | WebHID transport for browser |
| `@ledgerhq/wallet-cli` | Terminal CLI for Ledger wallet ops |

```bash
npm i @ledgerhq/device-management-kit @ledgerhq/device-management-kit-transport-webhid
```

### DMK Pattern (singleton)

```typescript
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { webHidTransportFactory } from "@ledgerhq/device-management-kit-transport-webhid";

const dmk = new DeviceManagementKit({ transports: [webHidTransportFactory] });

// User gesture required on first connect
const sessionId = await new Promise((resolve, reject) => {
  const sub = dmk.startDiscovering().subscribe({
    next: (id) => { sub.unsubscribe(); resolve(id); },
    error: reject,
  });
});
```

### ERC-7730 Clear Signing

| Resource | URL |
|---|---|
| Registry | [github.com/LedgerHQ/clear-signing-erc7730-registry](https://github.com/LedgerHQ/clear-signing-erc7730-registry) |
| Validate CLI | `npx @ledgerhq/erc7730-cli validate clear-signing/guardian_policy.erc7730.json` |
| Clear Signing Docs | [developers.ledger.com/docs/clear-signing](https://developers.ledger.com/docs/clear-signing/erc7730) |

**Rule:** `display.formats` key = full function signature string, e.g. `setGuardianPolicy(address,uint256,uint256,uint256)`.

### Developer prompts (copy-paste)

```
Add Ledger DMK WebHID connection to my Next.js app with connect/disconnect
badge showing CONNECTED (CLEAR SIGNING READY) vs DISCONNECTED (HARDWARE LOCKED).
Use @ledgerhq/device-management-kit — NOT legacy hw-transport-webhid.
```

```
Create an ERC-7730 descriptor for setGuardianPolicy(address,uint256,uint256,uint256)
on Base chainId 8453 with human-readable OLED labels for token, stop-loss price,
max amount, and max slippage.
```

---

## 2. The Graph Stack

### Agent Skills

| Skill | Install | Use when |
|---|---|---|
| Subgraph Skills | `npx skills add graphprotocol/subgraphs-skills` | Scaffold, deploy, debug subgraphs |
| Substreams Skills | [github.com/streamingfast/substreams-skills](https://github.com/streamingfast/substreams-skills) | Advanced streaming pipelines |

### CLI & MCP

```bash
npm i -g @graphprotocol/graph-cli

# Subgraph MCP — natural language queries from dev tools
npx @graphprotocol/subgraph-mcp
```

| Tool | Purpose |
|---|---|
| `graph init` | Scaffold subgraph from contract ABI |
| `graph codegen` | Generate AssemblyScript types |
| `graph build` | Compile subgraph |
| `graph deploy --studio <slug>` | Deploy to Subgraph Studio |

### Subgraph Studio Setup

1. Create account: [thegraph.com/studio](https://thegraph.com/studio/)
2. New subgraph → network: **Base**
3. Copy Deploy Key → `GRAPH_DEPLOY_KEY`
4. Query URL → `GRAPH_API_KEY` for authenticated queries

### Example Keeper Query

```graphql
query ActivePolicies {
  policies(where: { active: true }) {
    id
    token
    stopLossPrice
    maxAmount
    maxSlippageBps
  }
}
```

### Developer prompts

```
Create a subgraph schema for GuardianPolicyManager events PolicyCreated,
PolicyRevoked, and SessionExecuted on Base mainnet. Include Policy, Session,
and Execution entities with derivedFrom relations.
```

```
Wire the keeper bot to poll the Subgraph MCP for active policies every 30
seconds. Do NOT use subgraph data for price triggers — use Pyth Hermes instead.
```

**Docs:** [thegraph.com/docs](https://thegraph.com/docs/en/subgraphs/quick-start/)

---

## 3. Hedera & x402 Stack

### Agent Skills

| Skill | Install | Use when |
|---|---|---|
| Hedera Skills | `npx skills add hedera-dev/hedera-skills` | Account setup, SDK patterns, HTS |

### SDK Packages

| Package | Purpose |
|---|---|
| `@hashgraph/sdk` | Hedera transactions, account management |
| `@x402/core` | x402 protocol middleware |
| `@x402/hedera` | Hedera-specific payment signing |
| `@hashgraph/hedera-agent-kit` | Agent-friendly Hedera wrappers |

```bash
npm i @hashgraph/sdk @x402/core @x402/hedera
```

### Blocky402 Facilitator

| Environment | Base URL | Auth |
|---|---|---|
| Testnet | `https://api.testnet.blocky402.com` | Open (no key) |
| Mainnet | `https://api.blocky402.com` | `X-Api-Key: b402_<hex>` |

**Flow:**
1. `GET /supported` → discover `feePayer` for `hedera:testnet`
2. Sign payment with `@x402/hedera` `ExactHederaScheme`
3. `POST /verify` → `POST /settle`

**Reference PoC:** [github.com/hedera-dev/x402-inference-pay-per-request-poc](https://github.com/hedera-dev/x402-inference-pay-per-request-poc)

### Hedera Account Setup

| Network | How |
|---|---|
| Testnet | [portal.hedera.com](https://portal.hedera.com/) → Create **ECDSA** account → 1000 free HBAR/day |
| Mainnet | [HashPack wallet](https://www.hashpack.app/) or [supported wallets](https://docs.hedera.com/networks/mainnet/access) |

### Developer prompts

```
Wrap my keeper POST /trigger endpoint with x402 middleware using @x402/core
and @x402/hedera. Settle via Blocky402 testnet facilitator. Require 0.001 HBAR
(100000 tinybars) per call before executing the Base on-chain policy.
```

---

## 4. Base / EVM Stack

### Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup

cd packages/contracts
forge install rhinestone/modulekit
forge install pyth-network/pyth-sdk-solidity
```

### Wagmi (Frontend)

```bash
npm i wagmi viem @tanstack/react-query
```

```typescript
import { base } from "wagmi/chains";

export const config = createConfig({
  chains: [base],
  transports: { [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL) },
});
```

### Key Base Addresses

| Contract | Address |
|---|---|
| Pyth | `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a` |
| Uniswap v3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Chain ID | `8453` |
| RPC | `https://mainnet.base.org` |
| Explorer | [basescan.org](https://basescan.org) |
| Bridge | [bridge.base.org](https://bridge.base.org) |

### Pyth (Off-chain)

```bash
npm i @pythnetwork/price-service-client
```

```typescript
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

const connection = new PriceServiceConnection("https://hermes.pyth.network");
const vaa = await connection.getLatestVaas([ETH_USD_PRICE_FEED_ID]);
// Pass vaa bytes to executePolicy() — fetch inline, never cache
```

**Docs:** [docs.pyth.network](https://docs.pyth.network/price-feeds)

---

## 5. ERC-7579 Module Kit

```bash
forge install rhinestone/modulekit
```

| Interface | LGA usage |
|---|---|
| `IValidator` | SessionKeyValidator — bounds session key calls |
| `IExecutor` | SwapExecutor — DEX swap inside smart account |
| `IModule` | Install/uninstall modules on Guardian Vault |

**Docs:** [erc7579.com](https://erc7579.com/) · [github.com/rhinestonewtf/modulekit](https://github.com/rhinestonewtf/modulekit)

---

## 6. Skill → Task Matrix

| Build task | Primary skill/SDK |
|---|---|
| Ledger WebHID connect badge | `ledgerhq/agent-skills` + DMK |
| OLED clear signing | ERC-7730 JSON + registry PR |
| Deploy smart contracts | Foundry + rhinestone/modulekit |
| Index on-chain events | `graphprotocol/subgraphs-skills` |
| Keeper policy discovery | Subgraph MCP or GraphQL |
| Price trigger logic | `@pythnetwork/price-service-client` |
| Gate keeper API | `@x402/hedera` + Blocky402 |
| Frontend wallet writes | Wagmi + Viem on Base |

---

## 7. External Links (bookmark)

| Resource | URL |
|---|---|
| ETHOnline 2026 | [ethglobal.com/events/ethonline2026](https://ethglobal.com/events/ethonline2026) |
| Ledger Dev Portal | [developers.ledger.com](https://developers.ledger.com/) |
| The Graph Docs | [thegraph.com/docs](https://thegraph.com/docs/) |
| Subgraph MCP | [thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/) |
| Hedera Docs | [docs.hedera.com](https://docs.hedera.com/) |
| Blocky402 | [blocky402.com/docs](https://blocky402.com/docs/introduction/) |
| x402 Protocol | [github.com/x402-foundation/x402](https://github.com/x402-foundation/x402) |
| Base Docs | [docs.base.org](https://docs.base.org/) |
| Uniswap v3 Base | [docs.uniswap.org/contracts/v3/reference/deployments/base-deployments](https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments) |
