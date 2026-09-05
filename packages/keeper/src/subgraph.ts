export type PolicyRow = {
  id: `0x${string}`;
  owner: string;
  token: string;
  policyType: string;
  stopLossPrice: string;
  takeProfitPrice: string;
  maxAmount: string;
  maxSlippageBps: string;
};

const POLICIES_QUERY = `{
  policies(where: { active: true }, first: 50) {
    id owner token policyType stopLossPrice takeProfitPrice maxAmount maxSlippageBps
  }
}`;

export async function fetchActivePolicies(
  url: string,
  apiKey?: string,
): Promise<PolicyRow[]> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: POLICIES_QUERY }),
  });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const json = (await res.json()) as { data?: { policies?: PolicyRow[] }; errors?: unknown };
  if (json.errors) throw new Error(`subgraph errors ${JSON.stringify(json.errors)}`);
  return json.data?.policies ?? [];
}

export function mcpHint(url: string): string {
  return `Subgraph MCP → ${url} — query active policies, then decide STOP_LOSS vs TAKE_PROFIT vs skip`;
}
