import { DeviceActionStatus, type DeviceSessionId } from "@ledgerhq/device-management-kit";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import {
  createPublicClient,
  encodeFunctionData,
  hexToBytes,
  http,
  parseEther,
  parseUnits,
  serializeTransaction,
  type Address,
  type Hex,
  type Signature,
  type TransactionSerializableEIP1559,
} from "viem";
import { base } from "viem/chains";
import { guardianPolicyManagerAbi } from "./abi/GuardianPolicyManager";
import {
  derivationPathForAccount,
  formatLedgerError,
  getDMK,
  isUserRejection,
  type LogEntry,
} from "./ledger";

export type PolicyFormValues = {
  token: Address;
  stopLossUsd: string;
  maxAmount: string;
  maxAmountUnit: "eth" | "token";
  maxSlippagePercent: string;
};

export type PolicySignResult =
  | { status: "success"; txHash: Hex; from: Address }
  | { status: "rejected" }
  | { status: "error"; message: string };

function getRpcUrl(): string {
  return import.meta.env.VITE_BASE_RPC_URL ?? "https://mainnet.base.org";
}

function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(getRpcUrl()),
  });
}

export function parsePolicyParams(form: PolicyFormValues) {
  const stopLossPrice = parseUnits(form.stopLossUsd, 8);
  const maxAmount =
    form.maxAmountUnit === "eth"
      ? parseEther(form.maxAmount)
      : parseUnits(form.maxAmount, 18);
  const maxSlippageBps = BigInt(
    Math.round(parseFloat(form.maxSlippagePercent) * 100),
  );
  return { stopLossPrice, maxAmount, maxSlippageBps };
}

async function signTransactionOnLedger(
  sessionId: DeviceSessionId,
  tx: TransactionSerializableEIP1559,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex: number,
): Promise<Signature | "rejected"> {
  const dmk = getDMK();
  const signerEth = new SignerEthBuilder({ dmk, sessionId }).build();
  const serialized = serializeTransaction(tx);
  const txBuffer = hexToBytes(serialized);
  const path = derivationPathForAccount(accountIndex);
  const { observable } = signerEth.signTransaction(path, txBuffer);

  let lastInteraction: string | null = null;

  return new Promise((resolve) => {
    const sub = observable.subscribe({
      next: (state) => {
        switch (state.status) {
          case DeviceActionStatus.Pending: {
            const interaction = String(
              state.intermediateValue?.requiredUserInteraction ?? "unknown",
            );
            if (interaction !== lastInteraction) {
              lastInteraction = interaction;
              onLog({
                level: "info",
                message: `Ledger waiting — ${interaction}. Review setGuardianPolicy on device.`,
              });
            }
            break;
          }
          case DeviceActionStatus.Completed: {
            onLog({
              level: "success",
              message: "Policy approved on Ledger — broadcasting to Base…",
            });
            sub.unsubscribe();
            resolve({
              r: state.output.r,
              s: state.output.s,
              v: BigInt(state.output.v),
            });
            break;
          }
          case DeviceActionStatus.Stopped:
            onLog({ level: "warn", message: "Policy rejected on Ledger." });
            sub.unsubscribe();
            resolve("rejected");
            break;
          case DeviceActionStatus.Error: {
            const err = state.error;
            if (isUserRejection(err)) {
              onLog({
                level: "warn",
                message: `Policy rejected — ${formatLedgerError(err)}`,
              });
              sub.unsubscribe();
              resolve("rejected");
              break;
            }
            onLog({ level: "error", message: formatLedgerError(err) });
            sub.unsubscribe();
            resolve("rejected");
            break;
          }
          default:
            break;
        }
      },
      error: (err) => {
        onLog({
          level: isUserRejection(err) ? "warn" : "error",
          message: formatLedgerError(err),
        });
        sub.unsubscribe();
        resolve(isUserRejection(err) ? "rejected" : "rejected");
      },
    });
  });
}

export async function signAndSendSetGuardianPolicy(
  sessionId: DeviceSessionId,
  contractAddress: Address,
  from: Address,
  form: PolicyFormValues,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<PolicySignResult> {
  const client = getPublicClient();
  const { stopLossPrice, maxAmount, maxSlippageBps } = parsePolicyParams(form);

  const data = encodeFunctionData({
    abi: guardianPolicyManagerAbi,
    functionName: "setGuardianPolicy",
    args: [form.token, stopLossPrice, maxAmount, maxSlippageBps],
  });

  onLog({
    level: "info",
    message: `Encoding setGuardianPolicy(token=${form.token.slice(0, 10)}…, stop=${stopLossPrice}, max=${maxAmount}, slip=${maxSlippageBps} bps)`,
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
      "Confirm on Ledger OLED. With ERC-7730 registry merged, fields show as WETH / $2800 / etc. Until then you may see contract call details.",
  });

  const signature = await signTransactionOnLedger(sessionId, tx, onLog, accountIndex);
  if (signature === "rejected") return { status: "rejected" };

  const signedTx = serializeTransaction(tx, signature);
  const txHash = await client.sendRawTransaction({
    serializedTransaction: signedTx,
  });

  onLog({ level: "success", message: `Broadcast OK — tx ${txHash}` });
  console.log("[LGA] setGuardianPolicy tx:", txHash);

  return { status: "success", txHash, from };
}
