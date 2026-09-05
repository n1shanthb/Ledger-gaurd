import { encodeFunctionData, serializeTransaction, type Address, type TransactionSerializableEIP1559 } from "viem";
import { base } from "viem/chains";
import type { DeviceSessionId } from "@ledgerhq/device-management-kit";
import { guardianPolicyManagerAbi } from "./abi/GuardianPolicyManager";
import type { LogEntry } from "./ledger";
import { getPublicClient, signTransactionOnLedger, type PolicySignResult } from "./policyTx";

export async function signAndSendKillSwitch(
  sessionId: DeviceSessionId,
  contractAddress: Address,
  from: Address,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<PolicySignResult> {
  const client = getPublicClient();
  const data = encodeFunctionData({
    abi: guardianPolicyManagerAbi,
    functionName: "killSwitch",
  });

  onLog({
    level: "info",
    message: "Encoding killSwitch() — revokes all your policies and session keys.",
  });

  const [nonce, fees] = await Promise.all([
    client.getTransactionCount({ address: from }),
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

  onLog({
    level: "info",
    message:
      "Confirm on Ledger OLED: Revoke ALL guardian policies and disable keeper access.",
  });

  const signature = await signTransactionOnLedger(sessionId, tx, onLog, accountIndex);
  if (signature === "rejected") return { status: "rejected" };

  const signedTx = serializeTransaction(tx, signature);
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });

  onLog({ level: "success", message: `Kill switch broadcast — tx ${txHash}` });
  console.log("[LGA] killSwitch tx:", txHash);

  return { status: "success", txHash, from };
}
