/**
 * Decrypt secrets.env.enc → secrets.env via Node (UTF-8).
 * Avoids PowerShell array-join / Out-File corruption.
 *
 *   WALLET_PASS=… npm run ring:export
 *   # edit if needed
 *   WALLET_PASS=… npm run ring:enroll
 *   rm secrets.env
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ringDecrypt, ringAvailable } from "./ring";

if (!ringAvailable()) {
  console.error("[lga] wallet-cli missing");
  process.exit(1);
}
if (!process.env.WALLET_PASS) {
  console.error("[lga] set WALLET_PASS");
  process.exit(1);
}

const out = resolve(
  import.meta.dirname,
  "..",
  process.env.LGA_SECRETS_PLAIN ?? "secrets.env",
);

let text = ringDecrypt().replace(/^\uFEFF/, "").replace(/\u0000/g, "");
// same smash-fix as loadSecrets
text = text.replace(/(?<=\S)[ \t]+(?=[A-Z][A-Z0-9_]+=)/g, "\n");
if (!text.endsWith("\n")) text += "\n";

writeFileSync(out, text, "utf8");

const keys = [...text.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
console.log(`[lga] wrote ${out} (${keys.length} keys)`);
console.log(`[lga] keys: ${keys.join(", ")}`);
console.log("[lga] next: npm run ring:enroll  then delete secrets.env");
