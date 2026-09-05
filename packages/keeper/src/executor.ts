import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

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
}): Promise<Hex> {
  const account = privateKeyToAccount(opts.sessionKey);
  const publicClient = createPublicClient({ chain: base, transport: http(opts.rpc) });
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
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
