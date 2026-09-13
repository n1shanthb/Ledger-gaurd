import { SUBGRAPH_QUERY_URL, subgraphAuthHeaders } from "./constants";

export type PolicyRow = {
  id: string;
  owner: string;
  token: string;
  policyType: string | number;
  stopLossPrice: string;
  takeProfitPrice: string;
  maxAmount: string;
  maxSlippageBps?: string;
  active: boolean;
  createdAt: string;
};

export type ReceiptPolicy = {
  id: string;
  token: string;
  policyType: string | number;
  stopLossPrice: string;
  takeProfitPrice: string;
  maxAmount: string;
  maxSlippageBps: string;
  active: boolean;
  createdAt: string;
};

export type ReceiptRow = {
  id: string;
  policy: ReceiptPolicy;
  owner: string;
  triggerType: string | number;
  pythPrice: string;
  executionPrice: string;
  maxSlippageBps: string;
  actualSlippageBps: string;
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

export type PaymentAuditRow = {
  id: string;
  attemptId: string;
  policyId: string;
  baseTx: string;
  hederaPaymentRef: string;
  hcsRef: string;
  timestamp: string;
  txHash: string;
};

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const payload = JSON.stringify({ query, variables });
  // Browser → Next proxy (server holds Gateway key). SSR → Gateway direct.
  const res =
    typeof window === "undefined"
      ? await fetch(SUBGRAPH_QUERY_URL, {
          method: "POST",
          headers: subgraphAuthHeaders(),
          body: payload,
          cache: "no-store",
        })
      : await fetch("/api/receipt-graph", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          cache: "no-store",
        });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("subgraph empty");
  return json.data;
}

const POLICY_FIELDS =
  "id owner token policyType stopLossPrice takeProfitPrice maxAmount maxSlippageBps active createdAt";

const RECEIPT_FIELDS = `
  id
  owner
  triggerType
  pythPrice
  executionPrice
  maxSlippageBps
  actualSlippageBps
  compliant
  txHash
  timestamp
  policy {
    id token policyType stopLossPrice takeProfitPrice maxAmount maxSlippageBps active createdAt
  }
`;

export async function fetchPolicies(first = 50): Promise<PolicyRow[]> {
  const data = await gql<{ policies: PolicyRow[] }>(`
    {
      policies(first: ${first}, orderBy: createdAt, orderDirection: desc) {
        ${POLICY_FIELDS}
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
    paymentAudits: PaymentAuditRow[];
  }>(`
    {
      policies(first: 20, orderBy: createdAt, orderDirection: desc) {
        ${POLICY_FIELDS}
      }
      executionReceipts(first: 10, orderBy: timestamp, orderDirection: desc) {
        ${RECEIPT_FIELDS}
      }
      killSwitches(first: 10, orderBy: timestamp, orderDirection: desc) {
        id owner policiesRevoked timestamp
      }
      paymentAudits(first: 20, orderBy: timestamp, orderDirection: desc) {
        id attemptId policyId baseTx hederaPaymentRef hcsRef timestamp txHash
      }
    }
  `);
}
