# LGA Contracts (Base)

Foundry package for `GuardianPolicyManager` — policy registry, kill switch, execution receipts.

**Hackathon requirements:** [docs/HACKATHON.md](../../docs/HACKATHON.md)

## v2 Scope

| Feature | Contract function | Status |
|---|---|---|
| Stop-loss exit | `setGuardianPolicy` (stopLossPrice) | **v2** |
| Take-profit exit | `setGuardianPolicy` (takeProfitPrice) | **v2** |
| LP stop-loss | `PolicyType.LP_STOP_LOSS` | **v2** |
| Kill switch | `killSwitch()` | **v2** |
| Compliance receipt | `ExecutionReceipt` event | **v2** |
| Pyth execute | `executePolicy(policyId, vaas)` | **v2** |

## Live Deploy (v1)

| Field | Value |
|---|---|
| Address | `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103` |
| API | `setGuardianPolicy(token, stopLossPrice, maxAmount, maxSlippageBps)` |
| Proven | Ledger Account 2 clear-sign → Base mainnet |

See [DEPLOY.md](./DEPLOY.md) for full deploy history.

## Deploy v2 to Base

```bash
cd packages/contracts
forge install foundry-rs/forge-std --no-commit
forge test -vvv
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

Update addresses in `.env`, `clear-signing/*.erc7730.json`, and `packages/hardware-test/.env`.

## Test locally

```bash
forge test --fork-url https://mainnet.base.org -vvv
```

## ERC-7730 descriptors

| File | Function |
|---|---|
| `clear-signing/guardian_policy.erc7730.json` | `setGuardianPolicy` (v1 + v2 formats) |
| `clear-signing/kill_switch.erc7730.json` | `killSwitch()` |

```bash
npx @ledgerhq/erc7730-cli validate clear-signing/guardian_policy.erc7730.json
npx @ledgerhq/erc7730-cli validate clear-signing/kill_switch.erc7730.json
```

Submit PR to [ethereum/clear-signing-erc7730-registry](https://github.com/ethereum/clear-signing-erc7730-registry).
