import {
  encodeEventTopics,
  parseAbiItem,
  type Hex,
} from "viem";
import { GPM_V2, SUBGRAPH_QUERY_URL, subgraphAuthHeaders } from "@/lib/constants";

const POLICY_CREATED_TOPIC =
  "0xc0ef32a861a2cbcfc8adbaef809425e06c37350c1035bbcca774693fb590ac8a";

const EXEC_RECEIPT_EVENT = parseAbiItem(
  "event ExecutionReceipt(bytes32 indexed policyId, address indexed owner, bytes32 indexed receiptId, uint8 triggerType, uint256 pythPrice, uint256 executionPrice, uint256 maxSlippageBps, uint256 actualSlippageBps, bool compliant)",
);

const EXEC_TOPIC = encodeEventTopics({
  abi: [EXEC_RECEIPT_EVENT],
  eventName: "ExecutionReceipt",
})[0] as Hex;

export type OnchainPolicyCreated = {
  policyId: string;
  owner: string;
  token: string;
  policyType: number;
  txHash: string;
  blockNumber: number;
};

function rpcUrl() {
  return process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

function topicAddr(topic: string) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function policyTypeFromData(data: string): number {
  // first word = uint8 policyType
  const word = data.startsWith("0x") ? data.slice(2, 66) : data.slice(0, 64);
  return Number.parseInt(word, 16) || 0;
}

/** Recent PolicyCreated logs when Studio lags (public RPC, 2k-block chunks). */
export async function fetchRecentPolicyCreated(opts?: {
  owner?: string | null;
  lookbackBlocks?: number;
}): Promise<OnchainPolicyCreated[]> {
  const tipHex = await rpc<string>("eth_blockNumber", []);
  const tip = Number.parseInt(tipHex, 16);
  const lookback = opts?.lookbackBlocks ?? 8_000;
  const owner = opts?.owner?.toLowerCase() ?? null;
  const out: OnchainPolicyCreated[] = [];

  for (let end = tip; end > tip - lookback; end -= 2_000) {
    const start = Math.max(end - 1_999, tip - lookback);
    const topics: (string | null)[] = [POLICY_CREATED_TOPIC];
    if (owner) {
      topics.push(null);
      topics.push(`0x${"0".repeat(24)}${owner.slice(2)}`);
    }
    const logs = await rpc<
      {
        address: string;
        topics: string[];
        data: string;
        transactionHash: string;
        blockNumber: string;
      }[]
    >("eth_getLogs", [
      {
        address: GPM_V2,
        fromBlock: `0x${start.toString(16)}`,
        toBlock: `0x${end.toString(16)}`,
        topics,
      },
    ]);
    for (const log of logs ?? []) {
      out.push({
        policyId: log.topics[1],
        owner: topicAddr(log.topics[2]),
        token: topicAddr(log.topics[3]),
        policyType: policyTypeFromData(log.data),
        txHash: log.transactionHash,
        blockNumber: Number.parseInt(log.blockNumber, 16),
      });
    }
  }

  // newest first
  out.sort((a, b) => b.blockNumber - a.blockNumber);
  return out;
}

export type StudioMeta = {
  blockNumber: number;
  hasIndexingErrors: boolean;
};

export async function fetchStudioMeta(
  _queryUrl?: string,
): Promise<StudioMeta | null> {
  try {
    const body = JSON.stringify({
      query: "{ _meta { block { number } hasIndexingErrors } }",
    });
    const res =
      typeof window === "undefined"
        ? await fetch(_queryUrl || SUBGRAPH_QUERY_URL, {
            method: "POST",
            headers: subgraphAuthHeaders(),
            body,
            cache: "no-store",
          })
        : await fetch("/api/receipt-graph", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            cache: "no-store",
          });
    const j = (await res.json()) as {
      data?: { _meta?: { block?: { number: number }; hasIndexingErrors?: boolean } };
    };
    const n = j.data?._meta?.block?.number;
    if (n == null) return null;
    return {
      blockNumber: Number(n),
      hasIndexingErrors: !!j.data?._meta?.hasIndexingErrors,
    };
  } catch {
    return null;
  }
}

export type OnchainFillReceipt = {
  policyId: string;
  owner: string;
  triggerType: number;
  pythPrice: string;
  executionPrice: string;
  actualSlippageBps: string;
  compliant: boolean;
  txHash: string;
  blockNumber: number;
};

/** Live Base logs — popup must not wait on Graph index. */
export async function fetchOnchainOwnerFills(opts: {
  owner: string;
  lookbackBlocks?: number;
}): Promise<OnchainFillReceipt[]> {
  const tipHex = await rpc<string>("eth_blockNumber", []);
  const tip = Number.parseInt(tipHex, 16);
  const lookback = opts.lookbackBlocks ?? 8_000;
  const fromBlock = Math.max(0, tip - lookback);
  const owner = opts.owner.toLowerCase();
  const ownerTopic = `0x${owner.replace(/^0x/, "").padStart(64, "0")}`;

  const logs = await rpc<
    {
      address: string;
      topics: string[];
      data: string;
      transactionHash: string;
      blockNumber: string;
    }[]
  >("eth_getLogs", [
    {
      address: GPM_V2,
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: "latest",
      topics: [EXEC_TOPIC, null, ownerTopic],
    },
  ]);

  const out: OnchainFillReceipt[] = [];
  for (const log of logs ?? []) {
    const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
    if (data.length < 64 * 6) continue;
    const word = (i: number) => data.slice(i * 64, i * 64 + 64);
    const triggerType = Number.parseInt(word(0), 16);
    const pythPrice = BigInt(`0x${word(1)}`).toString();
    const executionPrice = BigInt(`0x${word(2)}`).toString();
    const actualSlippageBps = BigInt(`0x${word(4)}`).toString();
    const compliant = BigInt(`0x${word(5)}`) !== 0n;
    const policyId = log.topics[1] ?? "0x";
    out.push({
      policyId,
      owner: topicAddr(log.topics[2] ?? ""),
      triggerType,
      pythPrice,
      executionPrice,
      actualSlippageBps,
      compliant,
      txHash: log.transactionHash,
      blockNumber: Number.parseInt(log.blockNumber, 16),
    });
  }
  out.sort((a, b) => b.blockNumber - a.blockNumber);
  return out;
}
