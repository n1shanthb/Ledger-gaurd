import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import type { KeeperSecrets } from "./ring";

export function createPaidFetch(secrets: KeeperSecrets) {
  const accountId = secrets.hederaAccountId;
  if (!accountId) throw new Error("HEDERA_ACCOUNT_ID missing from Key Ring / env");
  const signer = createClientHederaSigner(
    accountId,
    PrivateKey.fromStringECDSA(secrets.sessionKey),
    { network: secrets.hederaNetwork },
  );
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "hedera:*", client: new ExactHederaScheme(signer) }],
    spendControls: { allowedAssets: true },
  });
}

export function triggerUrl(base?: string): string {
  const raw = base ?? process.env.KEEPER_URL ?? "http://127.0.0.1:3001/trigger";
  if (raw.endsWith("/trigger")) return raw;
  return `${raw.replace(/\/$/, "")}/trigger`;
}

export function quoteUrl(base?: string): string {
  const raw = base ?? process.env.KEEPER_URL ?? "http://127.0.0.1:3001";
  const root = raw.replace(/\/trigger\/?$/, "").replace(/\/$/, "");
  return `${root}/quote`;
}

export type PaidTriggerResult = {
  status: number;
  body: string;
  paymentResponse: string | null;
  hashscanUrl: string | null;
};

export function hashscanFromPayment(
  network: KeeperSecrets["hederaNetwork"],
  paymentResponse: string | null,
): string | null {
  if (!paymentResponse) return null;
  let decoded = paymentResponse;
  try {
    decoded = Buffer.from(paymentResponse, "base64").toString("utf8");
  } catch {
    /* already json */
  }
  const net = network === "hedera:mainnet" ? "mainnet" : "testnet";
  try {
    const j = JSON.parse(decoded) as Record<string, unknown>;
    const tx =
      (typeof j.transactionId === "string" && j.transactionId) ||
      (typeof j.txId === "string" && j.txId) ||
      (typeof j.transaction_id === "string" && j.transaction_id) ||
      null;
    if (tx) {
      return `https://hashscan.io/${net}/transaction/${encodeURIComponent(tx)}`;
    }
  } catch {
    /* ignore */
  }
  return `https://hashscan.io/${net}/account/${process.env.HEDERA_ACCOUNT_ID ?? ""}`;
}

export async function postPaidTrigger(
  secrets: KeeperSecrets,
  path: "trigger" | "quote" = "trigger",
): Promise<PaidTriggerResult> {
  const paid = createPaidFetch(secrets);
  const url = path === "quote" ? quoteUrl() : triggerUrl();
  const res = await paid(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = await res.text();
  const paymentResponse =
    res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("payment-response");
  return {
    status: res.status,
    body,
    paymentResponse,
    hashscanUrl: hashscanFromPayment(secrets.hederaNetwork, paymentResponse),
  };
}
