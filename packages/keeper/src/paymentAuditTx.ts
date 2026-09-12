import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import type { KeeperSecrets } from "./ring";

const auditAbi = [
  {
    type: "function",
    name: "recordPaymentAudit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attemptId", type: "bytes32" },
      { name: "policyId", type: "bytes32" },
      { name: "baseTx", type: "bytes32" },
      { name: "hederaPaymentRef", type: "string" },
      { name: "hcsRef", type: "string" },
    ],
    outputs: [],
  },
] as const;

function toBytes32(s: string): Hex {
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (hex.length === 64) return `0x${hex}` as Hex;
  return keccak256(toBytes(s));
}

export function paymentAuditConfigured(secrets: KeeperSecrets): boolean {
  const addr = (
    process.env.PAYMENT_AUDIT_LOG?.trim() ||
    secrets.paymentAuditLog?.trim() ||
    ""
  ).trim();
  return Boolean(addr && addr !== "0x");
}

export async function recordOnChainPaymentAudit(
  secrets: KeeperSecrets,
  opts: {
    attemptId: string;
    policyId: string;
    baseTx?: string;
    hederaPaymentRef: string;
    hcsRef: string;
  },
): Promise<Hex | null> {
  if (!paymentAuditConfigured(secrets)) {
    console.log("[lga] PAYMENT_AUDIT_LOG unset — skip on-chain audit");
    return null;
  }
  const addr = (process.env.PAYMENT_AUDIT_LOG?.trim() ||
    secrets.paymentAuditLog.trim()) as Hex;

  try {
    const account = privateKeyToAccount(secrets.sessionKey);
    const publicClient = createPublicClient({
      chain: base,
      transport: http(secrets.baseRpc),
    });
    const wallet = createWalletClient({
      account,
      chain: base,
      transport: http(secrets.baseRpc),
    });
    const data = encodeFunctionData({
      abi: auditAbi,
      functionName: "recordPaymentAudit",
      args: [
        toBytes32(opts.attemptId),
        opts.policyId as Hex,
        (opts.baseTx?.startsWith("0x")
          ? opts.baseTx
          : `0x${"0".repeat(64)}`) as Hex,
        opts.hederaPaymentRef.slice(0, 200),
        opts.hcsRef.slice(0, 200),
      ],
    });
    const hash = await wallet.sendTransaction({ to: addr, data });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[lga] PaymentAudit on-chain ${hash}`);
    return hash;
  } catch (e) {
    console.warn(
      "[lga] PaymentAudit tx failed",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
