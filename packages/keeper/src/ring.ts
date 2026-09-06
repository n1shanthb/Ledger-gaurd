import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";

const RING_KEY = process.env.LGA_RING_KEY ?? "lga-keeper";
const ENC_PATH = resolve(
  process.env.LGA_SECRETS_ENC ?? resolve(import.meta.dirname, "..", "secrets.env.enc"),
);

/** Resolve JS entry — Windows `.cmd` shims EINVAL under execFileSync. */
function resolveWalletCliJs(): string | null {
  if (process.env.WALLET_CLI_BIN && existsSync(process.env.WALLET_CLI_BIN)) {
    return process.env.WALLET_CLI_BIN;
  }
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const nested = resolve(dir, "node_modules", "@ledgerhq", "wallet-cli", "bin", "wallet-cli");
    if (existsSync(nested)) return nested;
    for (const shim of ["wallet-cli.cmd", "wallet-cli"]) {
      if (!existsSync(resolve(dir, shim))) continue;
      const fromShim = resolve(dir, "node_modules", "@ledgerhq", "wallet-cli", "bin", "wallet-cli");
      if (existsSync(fromShim)) return fromShim;
    }
  }
  // npm global default (Windows / Unix)
  const home = process.env.APPDATA ?? process.env.HOME;
  if (home) {
    const candidates = [
      resolve(home, "npm", "node_modules", "@ledgerhq", "wallet-cli", "bin", "wallet-cli"),
      resolve(home, ".npm-global", "lib", "node_modules", "@ledgerhq", "wallet-cli", "bin", "wallet-cli"),
    ];
    for (const c of candidates) if (existsSync(c)) return c;
  }
  return null;
}

function runWalletCli(
  args: string[],
  opts: { timeout?: number; stdio?: "inherit" | "pipe" } = {},
): string {
  const js = resolveWalletCliJs();
  if (!js) {
    throw new Error("wallet-cli not found — npm i -g @ledgerhq/wallet-cli");
  }
  return execFileSync(process.execPath, [js, ...args], {
    encoding: "utf8",
    timeout: opts.timeout ?? 60_000,
    stdio: opts.stdio === "inherit" ? "inherit" : "pipe",
    env: process.env,
  }) as string;
}

export type SecretsSource = "ring" | "env";

export type KeeperSecrets = {
  source: SecretsSource;
  ringKey: string;
  encPath: string;
  sessionKey: `0x${string}`;
  baseRpc: string;
  graphUrl: string;
  graphApiKey: string;
  facilitator: string;
  paymentAmount: string;
  manager: `0x${string}`;
  payTo: string;
  hederaNetwork: "hedera:mainnet" | "hedera:testnet";
  hederaAccountId: string;
};

export function ringAvailable(): boolean {
  try {
    runWalletCli(["--version"], { timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

/** Decrypt secrets.env.enc via Key Ring — no USB after ring init. Needs WALLET_PASS + network. */
export function ringDecrypt(encPath = ENC_PATH, key = RING_KEY): string {
  if (!existsSync(encPath)) {
    throw new Error(
      `missing ${encPath}: run \`npm run ring:enroll\` after wallet-cli ring init`,
    );
  }
  if (!process.env.WALLET_PASS) {
    throw new Error(
      "WALLET_PASS unset — inject from OS keychain (never put the password in the command text)",
    );
  }
  try {
    return runWalletCli(["ring", "decrypt", "--key", key, "-i", encPath]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `wallet-cli ring decrypt failed (${key}): ${msg}\n` +
        `init once with device: wallet-cli ring init\n` +
        `enroll: npm run ring:enroll`,
    );
  }
}

export function ringEncrypt(plainPath: string, encPath = ENC_PATH, key = RING_KEY): void {
  if (!existsSync(plainPath)) {
    throw new Error(`missing plaintext ${plainPath}`);
  }
  if (!process.env.WALLET_PASS) {
    throw new Error("WALLET_PASS unset — required for ring encrypt");
  }
  runWalletCli(["ring", "encrypt", "--key", key, "-i", plainPath, "-o", encPath], {
    stdio: "inherit",
  });
}

function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function get(
  bag: Record<string, string>,
  key: string,
  fallback?: string,
): string {
  const v = bag[key] ?? process.env[key];
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing ${key} in Key Ring secrets / env`);
}

function preferRing(): boolean {
  if (process.env.LGA_SECRETS_SOURCE === "env") return false;
  if (process.env.LGA_SECRETS_SOURCE === "ring") return true;
  return existsSync(ENC_PATH);
}

export function loadSecrets(): KeeperSecrets {
  let bag: Record<string, string> = {};
  let source: SecretsSource = "env";

  if (preferRing()) {
    if (!ringAvailable()) {
      throw new Error(
        "wallet-cli not on PATH — npm i -g @ledgerhq/wallet-cli (Key Ring required)",
      );
    }
    bag = parseEnvText(ringDecrypt());
    source = "ring";
    console.log(`[lga] secrets from Key Ring (${RING_KEY}) — ${ENC_PATH}`);
  } else {
    if (existsSync(resolve(import.meta.dirname, "..", ".env"))) {
      try {
        bag = parseEnvText(
          readFileSync(resolve(import.meta.dirname, "..", ".env"), "utf8"),
        );
      } catch {
        bag = {};
      }
    }
    console.warn(
      "[lga] secrets from env — Key Ring is required for Ledger prize demo (LGA_SECRETS_SOURCE=ring)",
    );
  }

  // Pyth helpers read process.env — surface keys from ring/env bag
  for (const k of ["PYTH_API_KEY", "PYTH_PRICE_SERVICE_URL", "BASE_RPC_URL"]) {
    const v = bag[k] ?? process.env[k];
    if (v) process.env[k] = v;
  }

  const hederaNetwork =
    (bag.HEDERA_NETWORK ?? process.env.HEDERA_NETWORK) === "mainnet"
      ? "hedera:mainnet"
      : "hedera:testnet";
  const accountId = get(bag, "HEDERA_ACCOUNT_ID", "");

  return {
    source,
    ringKey: RING_KEY,
    encPath: ENC_PATH,
    sessionKey: get(bag, "KEEPER_SESSION_KEY") as `0x${string}`,
    baseRpc: get(bag, "BASE_RPC_URL", "https://mainnet.base.org"),
    graphUrl: get(bag, "SUBGRAPH_QUERY_URL", ""),
    graphApiKey: get(bag, "GRAPH_API_KEY", ""),
    facilitator: get(
      bag,
      "BLOCKY402_FACILITATOR_URL",
      hederaNetwork === "hedera:mainnet"
        ? "https://api.blocky402.com"
        : "https://api.testnet.blocky402.com",
    ),
    paymentAmount: get(bag, "X402_PAYMENT_AMOUNT", "100000"),
    manager: get(
      bag,
      "GUARDIAN_POLICY_MANAGER_ADDRESS",
      "0xdBf463E260573797Dd1a03B4f45876aad777453b",
    ) as `0x${string}`,
    payTo: get(bag, "HEDERA_PAY_TO", accountId),
    hederaNetwork,
    hederaAccountId: accountId,
  };
}

export function ringStatus(secrets: KeeperSecrets) {
  return {
    source: secrets.source,
    ringKey: secrets.ringKey,
    encPresent: existsSync(secrets.encPath),
    walletCli: ringAvailable(),
    headless: secrets.source === "ring",
    note:
      secrets.source === "ring"
        ? "session key from Key Ring decrypt — no USB at runtime"
        : "env fallback — not Ledger prize ready",
  };
}
