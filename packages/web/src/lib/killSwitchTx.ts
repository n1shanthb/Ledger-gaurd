import type { DeviceSessionId } from "@ledgerhq/device-management-kit";
import {
  encodeFunctionData,
  serializeTransaction,
  type Address,
  type TransactionSerializableEIP1559,
} from "viem";
import { base } from "viem/chains";
import { guardianPolicyManagerAbi } from "./abi";
import type { LogEntry } from "./ledger";
import { signMessageOnLedger } from "./ledger";
import { killReviewMessage } from "./oledPreview";
import { getPublicClient, signTransactionOnLedger, type PolicySignResult } from "./policyTx";

export async function signAndSendKillSwitch(
  sessionId: DeviceSessionId,
  contractAddress: Address,
  from: Address,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<PolicySignResult> {
  const client = getPublicClient();
  const ethBal = await client.getBalance({ address: from });
  if (ethBal === 0n) {
    return {
      status: "error",
      message: `No Base ETH for gas on ${from}. Send ~$1–2 of ETH on Base, then retry.`,
    };
  }

  onLog({
    level: "info",
    message: "Step 1/2 — OLED kill-switch review…",
  });
  const reviewed = await signMessageOnLedger(
    sessionId,
    killReviewMessage(),
    onLog,
    accountIndex,
  );
  if (reviewed === "rejected") return { status: "rejected" };

  const data = encodeFunctionData({
    abi: guardianPolicyManagerAbi,
    functionName: "killSwitch",
  });

  onLog({
    level: "info",
    message: "Step 2/2 — clear-sign killSwitch() tx…",
  });

  const [nonce, fees] = await Promise.all([
    client.getTransactionCount({ address: from, blockTag: "pending" }),
    client.estimateFeesPerGas(),
  ]);

  const gas = await client.estimateGas({
    account: from,
    to: contractAddress,
    data,
  });

  const tx: TransactionSerializableEIP1559 = {
    type: "eip1559",
    chainId: base.id,
    nonce,
    to: contractAddress,
    value: 0n,
    data,
    gas,
    maxFeePerGas: fees.maxFeePerGas!,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas!,
  };

  const signature = await signTransactionOnLedger(sessionId, tx, onLog, accountIndex);
  if (signature === "rejected") return { status: "rejected" };

  const signedTx = serializeTransaction(tx, signature);
  try {
    const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });
    onLog({ level: "success", message: `Kill switch broadcast — tx ${txHash}` });
    return { status: "success", txHash, from };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("insufficient funds")) {
      return {
        status: "error",
        message: `Broadcast failed — not enough Base ETH for gas on ${from}.`,
      };
    }
    return { status: "error", message: msg };
  }
}
