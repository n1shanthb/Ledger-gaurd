import { DeviceActionStatus, type DeviceSessionId } from "@ledgerhq/device-management-kit";
import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  hexToBytes,
  http,
  maxUint256,
  parseAbi,
  parseEther,
  parseUnits,
  serializeTransaction,
  type Address,
  type Hex,
  type Signature,
  type TransactionSerializableEIP1559,
} from "viem";
import { base } from "viem/chains";
import { BASE_TOKENS, guardianPolicyManagerAbi, tokenDecimals } from "./abi";
import {
  derivationPathForAccount,
  buildSignerEth,
  formatLedgerError,
  isUserRejection,
  signMessageOnLedger,
  type LogEntry,
} from "./ledger";
import { policyReviewMessage } from "./oledPreview";

export type PolicyFormValues = {
  token: Address;
  policyType: 0 | 1 | 2 | 3;
  stopLossUsd: string;
  takeProfitUsd: string;
  maxAmount: string;
  maxAmountUnit: "eth" | "token" | "usdc";
  maxSlippagePercent: string;
};

export type PolicySignResult =
  | { status: "success"; txHash: Hex; from: Address }
  | { status: "rejected" }
  | { status: "error"; message: string };

const ERC20_ABI = parseAbi([
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

/** Leave enough native ETH for later gas (approve / policy / kill). */
const GAS_RESERVE = parseEther("0.00008");

function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
}

export function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(getRpcUrl()),
  });
}

export function isBuyDip(form: PolicyFormValues): boolean {
  return form.policyType === 3;
}

export function parsePolicyParams(form: PolicyFormValues) {
  const buy = isBuyDip(form);
  const stopLossPrice =
    form.policyType === 1 ? 0n : parseUnits(form.stopLossUsd || "0", 8);
  const takeProfitPrice =
    form.policyType === 1 || buy || Number(form.takeProfitUsd) > 0
      ? parseUnits(form.takeProfitUsd || "0", 8)
      : 0n;

  let maxAmount: bigint;
  if (buy || form.maxAmountUnit === "usdc") {
    maxAmount = parseUnits(form.maxAmount || "0", 6);
  } else if (
    form.maxAmountUnit === "eth" &&
    form.token.toLowerCase() === BASE_TOKENS.WETH.toLowerCase()
  ) {
    maxAmount = parseEther(form.maxAmount);
  } else {
    maxAmount = parseUnits(form.maxAmount, tokenDecimals(form.token));
  }

  const maxSlippageBps = BigInt(
    Math.round(parseFloat(form.maxSlippagePercent) * 100),
  );
  return { stopLossPrice, takeProfitPrice, maxAmount, maxSlippageBps };
}

export async function signTransactionOnLedger(
  sessionId: DeviceSessionId,
  tx: TransactionSerializableEIP1559,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex: number,
): Promise<Signature | "rejected"> {
  const signerEth = buildSignerEth(sessionId);
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
                message: `Ledger waiting — ${interaction}. Review on device.`,
              });
            }
            break;
          }
          case DeviceActionStatus.Completed: {
            onLog({
              level: "success",
              message: "Tx approved on Ledger — broadcasting to Base…",
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
            onLog({ level: "warn", message: "Tx rejected on Ledger." });
            sub.unsubscribe();
            resolve("rejected");
            break;
          case DeviceActionStatus.Error: {
            onLog({
              level: isUserRejection(state.error) ? "warn" : "error",
              message: formatLedgerError(state.error),
            });
            sub.unsubscribe();
            resolve("rejected");
            break;
          }
        }
      },
      error: (err) => {
        onLog({
          level: isUserRejection(err) ? "warn" : "error",
          message: formatLedgerError(err),
        });
        sub.unsubscribe();
        resolve("rejected");
      },
    });
  });
}

async function signSendRaw(
  sessionId: DeviceSessionId,
  from: Address,
  to: Address,
  data: Hex,
  value: bigint,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex: number,
): Promise<PolicySignResult> {
  const client = getPublicClient();
  const [nonce, fees] = await Promise.all([
    client.getTransactionCount({ address: from, blockTag: "pending" }),
    client.estimateFeesPerGas(),
  ]);
  const gas = await client.estimateGas({ account: from, to, data, value });
  const tx: TransactionSerializableEIP1559 = {
    type: "eip1559",
    chainId: base.id,
    nonce,
    to,
    value,
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

/** BUY_DIP: approve GPM to pull USDC. */
async function ensureUsdcForBuy(
  sessionId: DeviceSessionId,
  from: Address,
  gpm: Address,
  need: bigint,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex: number,
): Promise<PolicySignResult | null> {
  const client = getPublicClient();
  const usdc = BASE_TOKENS.USDC as Address;
  const bal = await client.readContract({
    address: usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [from],
  });
  if (bal < need) {
    return {
      status: "error",
      message: `Need ${formatUnits(need, 6)} USDC to buy. Have ${formatUnits(bal, 6)}.`,
    };
  }
  const allowance = await client.readContract({
    address: usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [from, gpm],
  });
  if (allowance < need) {
    onLog({
      level: "info",
      message: "Auto-approve GPM to pull USDC for the buy…",
    });
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [gpm, maxUint256],
    });
    const appr = await signSendRaw(sessionId, from, usdc, data, 0n, onLog, accountIndex);
    if (appr.status !== "success") return appr;
  }
  return null;
}

/** If policy is WETH and balance is short, wrap native ETH automatically. */
async function ensureWethForPolicy(
  sessionId: DeviceSessionId,
  from: Address,
  gpm: Address,
  need: bigint,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex: number,
): Promise<PolicySignResult | null> {
  const client = getPublicClient();
  const weth = BASE_TOKENS.WETH as Address;

  const wethBal = await client.readContract({
    address: weth,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [from],
  });

  if (wethBal < need) {
    const shortfall = need - wethBal;
    const ethBal = await client.getBalance({ address: from });
    if (ethBal < shortfall + GAS_RESERVE) {
      return {
        status: "error",
        message: `Need ${formatEther(shortfall)} ETH to wrap (+ gas reserve). Have ${formatEther(ethBal)} ETH / ${formatEther(wethBal)} WETH.`,
      };
    }
    onLog({
      level: "info",
      message: `Auto-wrap ${formatEther(shortfall)} ETH → WETH (shows as WETH in Ledger Live until fill)…`,
    });
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "deposit" });
    const wrap = await signSendRaw(
      sessionId,
      from,
      weth,
      data,
      shortfall,
      onLog,
      accountIndex,
    );
    if (wrap.status !== "success") return wrap;
  }

  const allowance = await client.readContract({
    address: weth,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [from, gpm],
  });
  if (allowance < need) {
    onLog({
      level: "info",
      message: "Auto-approve GPM to pull WETH for the exit…",
    });
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [gpm, maxUint256],
    });
    const appr = await signSendRaw(sessionId, from, weth, data, 0n, onLog, accountIndex);
    if (appr.status !== "success") return appr;
  }

  return null;
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
  const ethBal = await client.getBalance({ address: from });
  if (ethBal === 0n) {
    return {
      status: "error",
      message: `No Base ETH for gas on ${from}. Send ~$1–2 of ETH on Base to this address, then retry.`,
    };
  }

  const { stopLossPrice, takeProfitPrice, maxAmount: wanted, maxSlippageBps } =
    parsePolicyParams(form);

  const buy = isBuyDip(form);
  const isWeth = form.token.toLowerCase() === BASE_TOKENS.WETH.toLowerCase();
  let maxAmount = wanted;
  let formForChain = form;

  if (buy) {
    const usdc = BASE_TOKENS.USDC as Address;
    const usdcBal = await client.readContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [from],
    });
    if (usdcBal === 0n) {
      return {
        status: "error",
        message: `Need USDC on Base to buy ETH. Have 0 USDC on ${from}.`,
      };
    }
    if (wanted > usdcBal) {
      maxAmount = usdcBal;
      formForChain = {
        ...form,
        maxAmount: formatUnits(usdcBal, 6),
        maxAmountUnit: "usdc",
      };
      onLog({
        level: "warn",
        message: `USDC spend capped to ${formatUnits(usdcBal, 6)} (wallet balance).`,
      });
    }
  } else if (isWeth) {
    const weth = BASE_TOKENS.WETH as Address;
    const wethBal = await client.readContract({
      address: weth,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [from],
    });
    const ethBalNow = await client.getBalance({ address: from });
    const wrapRoom =
      ethBalNow > GAS_RESERVE ? ethBalNow - GAS_RESERVE : 0n;
    const affordable = wethBal + wrapRoom;

    if (affordable === 0n) {
      return {
        status: "error",
        message: `Not enough ETH/WETH for a policy after gas reserve. Have ${formatEther(ethBalNow)} ETH / ${formatEther(wethBal)} WETH.`,
      };
    }

    if (wanted > affordable) {
      maxAmount = affordable;
      formForChain = {
        ...form,
        maxAmount: formatEther(affordable),
        maxAmountUnit: "eth",
      };
      onLog({
        level: "warn",
        message: `Max amount capped to ${formatEther(affordable)} ETH (wallet can fund that; form had ${form.maxAmount}).`,
      });
    }
  }

  const review = policyReviewMessage(formForChain, {
    autoWrap: isWeth && !buy,
    buyDip: buy,
  });
  onLog({
    level: "info",
    message: "OLED policy review (scroll device to read details)…",
  });
  const reviewed = await signMessageOnLedger(sessionId, review, onLog, accountIndex);
  if (reviewed.status === "rejected") return { status: "rejected" };
  if (reviewed.status === "error") return { status: "error", message: reviewed.message };

  if (buy) {
    const prep = await ensureUsdcForBuy(
      sessionId,
      from,
      contractAddress,
      maxAmount,
      onLog,
      accountIndex,
    );
    if (prep) return prep;
  } else if (isWeth) {
    const prep = await ensureWethForPolicy(
      sessionId,
      from,
      contractAddress,
      maxAmount,
      onLog,
      accountIndex,
    );
    if (prep) return prep;
  }

  const data = encodeFunctionData({
    abi: guardianPolicyManagerAbi,
    functionName: "setGuardianPolicy",
    args: [
      form.token,
      form.policyType,
      stopLossPrice,
      takeProfitPrice,
      maxAmount,
      maxSlippageBps,
    ],
  });

  onLog({
    level: "info",
    message: "Clear-sign setGuardianPolicy tx on OLED…",
  });

  const result = await signSendRaw(
    sessionId,
    from,
    contractAddress,
    data,
    0n,
    onLog,
    accountIndex,
  );
  if (result.status === "success") {
    onLog({
      level: "info",
      message: buy
        ? "Buy-dip live. Keeper spends USDC → WETH when ETH hits your level."
        : "Policy live. Protected amount sits as WETH in Ledger Live until stop/take fills → USDC.",
    });
  }
  return result;
}
