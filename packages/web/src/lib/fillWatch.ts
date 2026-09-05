import { SUBGRAPH_QUERY_URL } from "./constants";

export type OwnerReceipt = {
  id: string;
  triggerType: string | number;
  pythPrice: string;
  executionPrice: string;
  compliant: boolean;
  txHash: string;
  timestamp: string;
  policy: { id: string };
};

export async function fetchOwnerReceipts(
  owner: string,
  afterTs?: number,
): Promise<OwnerReceipt[]> {
  const o = owner.toLowerCase();
  const res = await fetch(SUBGRAPH_QUERY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `{
        executionReceipts(
          first: 10
          orderBy: timestamp
          orderDirection: desc
          where: { owner: "${o}" }
        ) {
          id triggerType pythPrice executionPrice compliant txHash timestamp
          policy { id }
        }
      }`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const json = (await res.json()) as {
    data?: { executionReceipts: OwnerReceipt[] };
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const rows = json.data?.executionReceipts ?? [];
  if (afterTs == null) return rows;
  return rows.filter((r) => Number(r.timestamp) > afterTs);
}

export async function fetchPythBand(asset = "eth"): Promise<{
  usd: number;
  source: string;
  stopLossUsd: number;
  takeProfitUsd: number;
  warning?: string;
}> {
  const res = await fetch(`/api/pyth?asset=${asset}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`pyth api ${res.status}`);
  return res.json();
}
