import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import { loadSecrets } from "./ring";

const secrets = loadSecrets();
const accountId = secrets.hederaAccountId;
if (!accountId) throw new Error("HEDERA_ACCOUNT_ID missing from Key Ring / env");

const signer = createClientHederaSigner(
  accountId,
  PrivateKey.fromStringECDSA(secrets.sessionKey),
  { network: secrets.hederaNetwork },
);
const paid = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "hedera:*", client: new ExactHederaScheme(signer) }],
  spendControls: { allowedAssets: true },
});

const url = process.env.KEEPER_URL ?? "http://127.0.0.1:3001/trigger";
const res = await paid(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

console.log("[lga] pay status", res.status);
console.log("[lga] pay body", await res.text());
const pr = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("payment-response");
if (pr) {
  try {
    console.log("[lga] payment-response", Buffer.from(pr, "base64").toString("utf8"));
  } catch {
    console.log("[lga] payment-response raw", pr);
  }
}
