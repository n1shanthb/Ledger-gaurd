import type { DeviceSessionId } from "@ledgerhq/device-management-kit";
import {
  encodeFunctionData,
  maxUint256,
  parseEther,
  serializeTransaction,
  type Address,
  type TransactionSerializableEIP1559,
} from "viem";
import { base } from "viem/chains";
import { BASE_TOKENS } from "./abi";
import type { LogEntry } from "./ledger";
import {
  getPublicClient,
  signTransactionOnLedger,
  type PolicySignResult,
} from "./policyTx";

const WETH_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const SESSION_ABI = [
  {
    type: "function",
    name: "setSessionKey",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export const SESSION_VALIDATOR =
  (process.env.NEXT_PUBLIC_SESSION_VALIDATOR as Address | undefined) ??
  ("0xA7b4aB91e4792c831F49Bb915171AEDaB507bc39" as Address);

export const KEEPER_SESSION_KEY =
  (process.env.NEXT_PUBLIC_KEEPER_ADDRESS as Address | undefined) ??
  ("0x6304aC44968A032693afe8ddBB74e3Dd05D3692B" as Address);

async function signSend(
  sessionId: DeviceSessionId,
  from: Address,
  txPartial: Omit<TransactionSerializableEIP1559, "type" | "chainId" | "nonce" | "gas" | "maxFeePerGas" | "maxPriorityFeePerGas"> & {
    value?: bigint;
  },
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex: number,
): Promise<PolicySignResult> {
  const client = getPublicClient();
  const ethBal = await client.getBalance({ address: from });
  if (ethBal === 0n) {
    return {
      status: "error",
      message: `No Base ETH for gas on ${from}. Fund it first.`,
    };
  }

  const [nonce, fees] = await Promise.all([
    client.getTransactionCount({ address: from, blockTag: "pending" }),
    client.estimateFeesPerGas(),
  ]);

  const gas = await client.estimateGas({
    account: from,
    to: txPartial.to,
    data: txPartial.data,
    value: txPartial.value ?? 0n,
  });

  const tx: TransactionSerializableEIP1559 = {
    type: "eip1559",
    chainId: base.id,
    nonce,
    to: txPartial.to,
    value: txPartial.value ?? 0n,
    data: txPartial.data,
    gas,
    maxFeePerGas: fees.maxFeePerGas!,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas!,
  };

  const signature = await signTransactionOnLedger(sessionId, tx, onLog, accountIndex);
  if (signature === "rejected") return { status: "rejected" };

  const signedTx = serializeTransaction(tx, signature);
  try {
    const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });
    onLog({ level: "success", message: `Broadcast OK — ${txHash}` });
    onLog({ level: "info", message: "Waiting for confirmation…" });
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
    });
    if (receipt.status !== "success") {
      return { status: "error", message: `Tx reverted on-chain — ${txHash}` };
    }
    return { status: "success", txHash, from };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Wrap native ETH → WETH (leave gas behind). */
export async function wrapEthToWeth(
  sessionId: DeviceSessionId,
  from: Address,
  amountEth: string,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<PolicySignResult> {
  const value = parseEther(amountEth);
  onLog({ level: "info", message: `Wrapping ${amountEth} ETH → WETH…` });
  const data = encodeFunctionData({ abi: WETH_ABI, functionName: "deposit" });
  return signSend(
    sessionId,
    from,
    { to: BASE_TOKENS.WETH as Address, data, value },
    onLog,
    accountIndex,
  );
}

/** Approve GPM to pull WETH for fills. */
export async function approveGpmWeth(
  sessionId: DeviceSessionId,
  from: Address,
  gpm: Address,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<PolicySignResult> {
  onLog({ level: "info", message: `Approving GPM ${gpm.slice(0, 10)}… for WETH` });
  const data = encodeFunctionData({
    abi: WETH_ABI,
    functionName: "approve",
    args: [gpm, maxUint256],
  });
  return signSend(
    sessionId,
    from,
    { to: BASE_TOKENS.WETH as Address, data },
    onLog,
    accountIndex,
  );
}

/** Allow keeper session key to execute policies for this owner. */
export async function enableKeeperSession(
  sessionId: DeviceSessionId,
  from: Address,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
  keeper: Address = KEEPER_SESSION_KEY,
): Promise<PolicySignResult> {
  onLog({
    level: "info",
    message: `setSessionKey(${keeper.slice(0, 10)}…, true)`,
  });
  const data = encodeFunctionData({
    abi: SESSION_ABI,
    functionName: "setSessionKey",
    args: [keeper, true],
  });
  return signSend(
    sessionId,
    from,
    { to: SESSION_VALIDATOR, data },
    onLog,
    accountIndex,
  );
}

export function instantTriggerDefaults(spotUsd: number | null): {
  stopLossUsd: string;
  takeProfitUsd: string;
  maxAmount: string;
} {
  // Stop ABOVE spot → already triggered (spot <= stop)
  const stop = spotUsd != null ? Math.ceil(spotUsd * 1.5) : 10000;
  return {
    stopLossUsd: String(stop),
    takeProfitUsd: "1",
    maxAmount: "0.0001",
  };
}
