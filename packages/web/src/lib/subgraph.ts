import { SUBGRAPH_QUERY_URL } from "./constants";

export type PolicyRow = {
  id: string;
  owner: string;
  token: string;
  policyType: string | number;
  stopLossPrice: string;
  takeProfitPrice: string;
  maxAmount: string;
  active: boolean;
  createdAt: string;
};

export type ReceiptRow = {
  id: string;
  policy: { id: string };
  owner: string;
  triggerType: string | number;
  pythPrice: string;
  executionPrice: string;
  compliant: boolean;
  txHash: string;
  timestamp: string;
};

export type KillRow = {
  id: string;
  owner: string;
  policiesRevoked: string;
  timestamp: string;
};

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_QUERY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("subgraph empty");
  return json.data;
}

export async function fetchPolicies(first = 50): Promise<PolicyRow[]> {
  const data = await gql<{ policies: PolicyRow[] }>(`
    {
      policies(first: ${first}, orderBy: createdAt, orderDirection: desc) {
        id owner token policyType stopLossPrice takeProfitPrice maxAmount active createdAt
      }
    }
  `);
  return data.policies;
}

export async function fetchConsoleData() {
  return gql<{
    policies: PolicyRow[];
    executionReceipts: ReceiptRow[];
    killSwitches: KillRow[];
  }>(`
    {
      policies(first: 20, orderBy: createdAt, orderDirection: desc) {
        id owner token policyType stopLossPrice takeProfitPrice maxAmount active createdAt
      }
      executionReceipts(first: 10, orderBy: timestamp, orderDirection: desc) {
        id policy { id } owner triggerType pythPrice executionPrice compliant txHash timestamp
      }
      killSwitches(first: 10, orderBy: timestamp, orderDirection: desc) {
        id owner policiesRevoked timestamp
      }
    }
  `);
}
