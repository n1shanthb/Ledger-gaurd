import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import type { KeeperSecrets } from "./ring";
import {
  createCapabilityBroker,
  publicCapability,
  type Capability,
  type CapabilityBroker,
} from "./capabilities";

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

/** Strip accidental /trigger or /quote so KEEPER_URL can be host or full path. */
function keeperRoot(base?: string): string {
  const raw = base ?? process.env.KEEPER_URL ?? "http://127.0.0.1:3001";
  return raw
    .replace(/\/trigger\/?$/, "")
    .replace(/\/quote\/?$/, "")
    .replace(/\/$/, "");
}

export function triggerUrl(base?: string): string {
  return `${keeperRoot(base)}/trigger`;
}

export function quoteUrl(base?: string): string {
  return `${keeperRoot(base)}/quote`;
}

export type PaidTriggerResult = {
  status: number;
  body: string;
  paymentResponse: string | null;
  hashscanUrl: string | null;
  capability?: ReturnType<typeof publicCapability>;
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
      (typeof j.transaction === "string" && j.transaction) ||
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

export type PaidTriggerOpts = {
  /** Existing capability id — fail closed if missing/expired/wrong scope */
  capabilityId?: string;
  /**
   * Hot path stamp: Autopilot / `npm run pay` / Payer mint in-process.
   * Not a separate agent request API — just a server-side TTL handle.
   * Default true; set false to require capabilityId (fail closed).
   */
  mintInternal?: boolean;
  broker?: CapabilityBroker;
  ttlMs?: number;
  /** Stamped on host HCS memo + PaymentAudit bridge (payer | autopilot | cli). */
  agentId?: string;
};

export async function postPaidTrigger(
  secrets: KeeperSecrets,
  path: "trigger" | "quote" = "trigger",
  opts: PaidTriggerOpts = {},
): Promise<PaidTriggerResult> {
  const needed = path === "quote" ? "pay:quote" : "pay:trigger";
  const broker = opts.broker ?? createCapabilityBroker(secrets);
  const mintInternal = opts.mintInternal !== false;

  let cap: Capability;
  if (opts.capabilityId) {
    cap = broker.require(opts.capabilityId, needed);
  } else if (mintInternal) {
    cap = broker.mint(needed, opts.ttlMs ?? 120_000);
  } else {
    throw new Error(
      `capability required for ${needed} — broker hands out scopes, never raw API keys`,
    );
  }

  const paid = createPaidFetch(secrets);
  const url = path === "quote" ? quoteUrl() : triggerUrl();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.agentId) headers["x-lga-agent"] = opts.agentId;
  const res = await paid(url, {
    method: "POST",
    headers,
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
    capability: publicCapability(cap),
  };
}
