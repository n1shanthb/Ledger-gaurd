import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  createCapabilityBroker,
  stampCapability,
  type CapabilityBroker,
} from "./capabilities";
import type { KeeperSecrets } from "./ring";

const executeAbi = [
  {
    type: "function",
    name: "executePolicy",
    stateMutability: "payable",
    inputs: [
      { name: "policyId", type: "bytes32" },
      { name: "priceUpdateData", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const;

export async function executePolicy(opts: {
  rpc: string;
  sessionKey: Hex;
  manager: Hex;
  policyId: Hex;
  vaas: Hex[];
  /** Required — omitting used to skip the broker gate. */
  secrets: KeeperSecrets;
  broker?: CapabilityBroker;
  capabilityId?: string;
  /** Default true: Driver/Autopilot stamp. Set false to require capabilityId. */
  mintInternal?: boolean;
}): Promise<Hex> {
  const scope = `execute:policy:${opts.policyId}`;
  const broker = opts.broker ?? createCapabilityBroker(opts.secrets);
  const mintInternal = opts.mintInternal !== false;
  if (opts.capabilityId) {
    broker.require(opts.capabilityId, scope);
  } else if (mintInternal) {
    stampCapability(broker, scope, 120_000);
  } else {
    throw new Error(
      `capability required for ${scope} — broker hands out scopes, never raw API keys`,
    );
  }

  const account = privateKeyToAccount(opts.sessionKey);
  const publicClient = createPublicClient({
    chain: base,
    transport: http(opts.rpc),
  });
  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(opts.rpc),
  });

  const data = encodeFunctionData({
    abi: executeAbi,
    functionName: "executePolicy",
    args: [opts.policyId, opts.vaas],
  });

  const hash = await wallet.sendTransaction({
    to: opts.manager,
    data,
  });
  console.log(`[lga] Driver executePolicy ${opts.policyId.slice(0, 10)}…`);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
