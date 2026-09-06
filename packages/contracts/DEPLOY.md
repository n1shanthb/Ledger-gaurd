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

## v3 live on Base (BUY_DIP)

| Contract | Address |
|---|---|
| **GuardianPolicyManager** | [`0xdBf463E260573797Dd1a03B4f45876aad777453b`](https://basescan.org/address/0xdBf463E260573797Dd1a03B4f45876aad777453b) |
| SessionKeyValidator | [`0xf93f56DF8481144F507dFCf30712658202E164e4`](https://basescan.org/address/0xf93f56DF8481144F507dFCf30712658202E164e4) |
| SwapExecutor (reused) | [`0x4767a9Deee297d73B72cDD850850D11B221034Ab`](https://basescan.org/address/0x4767a9Deee297d73B72cDD850850D11B221034Ab) |
| Deploy tx | [`0x8ce0c859…`](https://basescan.org/tx/0x8ce0c859dbb5df8be3117239637215fc5d4119c54f320ea645e99563e761f6c2) |
| startBlock | `50944222` |

### Prior v2 (exits only)

| Contract | Address |
|---|---|
| GuardianPolicyManager | [`0xd3EA42c79a00098E9Fe87A86aF3E9C7bC327a80E`](https://basescan.org/address/0xd3EA42c79a00098E9Fe87A86aF3E9C7bC327a80E) |
| SessionKeyValidator | [`0xA7b4aB91e4792c831F49Bb915171AEDaB507bc39`](https://basescan.org/address/0xA7b4aB91e4792c831F49Bb915171AEDaB507bc39) |
| startBlock | `50868775` |

## v2 (code ready — redeploy)

v2 deploys **three** contracts: `SwapExecutor`, `GuardianPolicyManager`, `SessionKeyValidator`.

```powershell
forge script script/Deploy.s.sol:Deploy --rpc-url $env:BASE_RPC_URL --broadcast -vvvv
```

Copy the new GPM address into:

- `packages/hardware-test/.env` → `VITE_GUARDIAN_POLICY_MANAGER_ADDRESS`
- `clear-signing/*.erc7730.json` deployments
- `packages/subgraph/subgraph.yaml` address + startBlock
- `.env` → `GUARDIAN_POLICY_MANAGER_ADDRESS`

| Feature | Status |
|---|---|
| Take-profit | v2 `setGuardianPolicy` 6-param |
| Kill switch | `killSwitch()` + ERC-7730 |
| ExecutionReceipt | emitted on `executePolicy` |
| Session keys | `SessionKeyValidator.setSessionKey` |

v1 remains live at `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103` (4-param stop-loss only). Hardware test can point at either address until v2 is broadcast.
