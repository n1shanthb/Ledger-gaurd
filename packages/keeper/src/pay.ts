import { loadSecrets } from "./ring";
import { postPaidTrigger } from "./paidTrigger";

const secrets = loadSecrets();
const path = process.argv.includes("--quote") ? "quote" : "trigger";
const result = await postPaidTrigger(secrets, path);

console.log("[lga] pay status", result.status);
console.log("[lga] pay body", result.body);
if (result.paymentResponse) {
  try {
    console.log(
      "[lga] payment-response",
      Buffer.from(result.paymentResponse, "base64").toString("utf8"),
    );
  } catch {
    console.log("[lga] payment-response raw", result.paymentResponse);
  }
}
if (result.hashscanUrl) console.log("[lga] hashscan", result.hashscanUrl);
