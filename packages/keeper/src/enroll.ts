import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { ringAvailable, ringEncrypt } from "./ring";

const root = resolve(import.meta.dirname, "..");
const plain = resolve(root, process.env.LGA_SECRETS_PLAIN ?? "secrets.env");
const enc = resolve(root, process.env.LGA_SECRETS_ENC ?? "secrets.env.enc");
const example = resolve(root, "secrets.env.example");

if (!ringAvailable()) {
  console.error("[lga] install wallet-cli: npm i -g @ledgerhq/wallet-cli");
  process.exit(1);
}

if (!existsSync(plain)) {
  if (existsSync(example)) {
    copyFileSync(example, plain);
    console.error(
      `[lga] created ${plain} from example — fill secrets, then re-run enroll`,
    );
    process.exit(1);
  }
  console.error(`[lga] missing ${plain}`);
  process.exit(1);
}

if (!process.env.WALLET_PASS) {
  console.error(
    "[lga] set WALLET_PASS from OS keychain before enroll (device only needed for ring init once)",
  );
  process.exit(1);
}

console.log("[lga] encrypting", plain, "→", enc);
ringEncrypt(plain, enc);
console.log("[lga] enrolled. Keeper host needs WALLET_PASS + network, no USB.");
console.log("[lga] delete plaintext secrets.env when done (gitignored).");
