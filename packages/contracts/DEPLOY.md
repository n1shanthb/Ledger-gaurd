# Deploy GuardianPolicyManager to Base (PowerShell)

Foundry is installed at **`E:\foundry\bin`** (not C:).

## 1. Open a new terminal

Restart the terminal so `forge` is on PATH, or run:

```powershell
$env:Path += ";E:\foundry\bin"
$env:FOUNDRY_DIR = "E:\foundry"
forge --version
```

## 2. Fund a deployer wallet on Base

Your **phone MetaMask** can hold funds, but **Foundry CLI needs a private key on PC**.

Pick one:

| Option | How |
|---|---|
| **A (easiest)** | Install MetaMask browser extension → sync/recover same wallet → use that account's private key |
| **B** | Create a fresh hot wallet in MetaMask extension, send ~$2 ETH on Base from phone |
| **C** | MetaMask mobile → Account details → Export Private Key (hackathon deployer only) |

Bridge ETH to Base: [bridge.base.org](https://bridge.base.org/)

## 3. Configure env

```powershell
cd e:\ledgergaurd\packages\contracts
copy .env.example .env
# Edit .env — set DEPLOYER_PRIVATE_KEY and BASE_RPC_URL
```

## 4. Test compile

```powershell
forge test -vvv
```

## 5. Deploy to Base Mainnet

```powershell
forge script script/Deploy.s.sol:Deploy `
  --rpc-url $env:BASE_RPC_URL `
  --broadcast `
  -vvvv
```

Or with `.env` loaded:

```powershell
forge script script/Deploy.s.sol:Deploy --rpc-url https://mainnet.base.org --broadcast -vvvv
```

Foundry auto-loads `.env` from the project root.

## 6. Copy address to frontend

```env
# packages/hardware-test/.env
VITE_GUARDIAN_POLICY_MANAGER_ADDRESS=0xDeployedAddress
VITE_BASE_RPC_URL=https://mainnet.base.org
```

Update `clear-signing/guardian_policy.erc7730.json` deployment address too.

## Verify on Basescan (optional)

```powershell
forge verify-contract 0xYourAddress src/GuardianPolicyManager.sol:GuardianPolicyManager `
  --chain base `
  --etherscan-api-key $env:BASESCAN_API_KEY
```

Get API key: [basescan.org/myapikey](https://basescan.org/myapikey)

## Deployed on Base Mainnet (Remix)

| Field | Value |
|---|---|
| **Contract** | `GuardianPolicyManager` |
| **Address** | `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103` |
| **Tx hash** | `0xf0b80aa503adcce0f01d4ec5f60b19accd792240fbe7903a6dd8403e17a5fc00` |
| **Deployer** | `0xDeC2B0E211a4a70D7d8863a57359A503bC77df4b` |
| **Explorer** | [Basescan](https://basescan.org/address/0x53C25a50B2f40EF8bFD3d673ec667cCB912af103) |

Wire this into `packages/hardware-test/.env` and `clear-signing/*.erc7730.json` (already done in repo).

## v2 Roadmap

| Feature | Target |
|---|---|
| Take-profit (`takeProfitPrice`) | v2 contract redeploy |
| LP stop-loss (`PolicyType.LP_STOP_LOSS`) | v2 contract |
| Kill switch (`killSwitch()`) | v2 contract + `kill_switch.erc7730.json` |
| Receipt Graph (`ExecutionReceipt` events) | `packages/subgraph` |
| x402 keeper `/trigger` | `packages/keeper` |
