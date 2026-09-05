import { execFileSync } from "node:child_process";

const RING_BIN = process.env.WALLET_CLI_BIN ?? "wallet-cli";

export function ringGet(key: string): string {
  try {
    const out = execFileSync(RING_BIN, ["ring", "get", key], {
      encoding: "utf8",
      timeout: 8_000,
    }).trim();
    if (out) {
      console.log(`[lga] ${key} from wallet-cli ring`);
      return out;
    }
  } catch {
    // ring missing or key not enrolled — fall through
  }

  const env = process.env[key];
  if (!env) {
    throw new Error(
      `missing ${key}: run \`wallet-cli ring set ${key} ...\` (or set env for local only)`,
    );
  }
  console.warn(`[lga] ${key} from env — Key Ring is required in prod`);
  return env;
}

export type KeeperSecrets = {
  sessionKey: `0x${string}`;
  baseRpc: string;
  graphUrl: string;
  graphApiKey: string;
  facilitator: string;
  paymentAmount: string;
  manager: `0x${string}`;
};

export function loadSecrets(): KeeperSecrets {
  const sessionKey = ringGet("KEEPER_SESSION_KEY") as `0x${string}`;
  return {
    sessionKey,
    baseRpc: ringGet("BASE_RPC_URL"),
    graphUrl: ringGet("SUBGRAPH_QUERY_URL"),
    graphApiKey: process.env.GRAPH_API_KEY ?? "",
    facilitator:
      process.env.BLOCKY402_FACILITATOR_URL ??
      "https://api.testnet.blocky402.com",
    paymentAmount: process.env.X402_PAYMENT_AMOUNT ?? "100000",
    manager: ringGet("GUARDIAN_POLICY_MANAGER_ADDRESS") as `0x${string}`,
  };
}
