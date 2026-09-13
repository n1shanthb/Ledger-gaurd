import {
  assertGraphAvailable,
  graphCooldownRemaining,
  noteGraphHttpStatus,
} from "./graphGuard";

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

type Cache = { url: string; at: number; rows: PolicyRow[] };
let policyCache: Cache | null = null;

/** Policy list TTL — Autopilot bands use Hermes/Pyth, not Graph prices. */
const CACHE_MS = Number(process.env.GRAPH_POLICY_CACHE_MS ?? 300_000);
/** Serve stale cache under cooldown / 429 (still not mocked). */
const STALE_MS = Number(process.env.GRAPH_POLICY_STALE_MS ?? 900_000);

function cachedRows(url: string, maxAge: number): PolicyRow[] | null {
  if (!policyCache || policyCache.url !== url) return null;
  if (Date.now() - policyCache.at > maxAge) return null;
  return policyCache.rows;
}

export async function fetchActivePolicies(
  url: string,
  apiKey?: string,
): Promise<PolicyRow[]> {
  if (!url) return [];

  const fresh = cachedRows(url, CACHE_MS);
  if (fresh) return fresh;

  // Cooling: never hit Studio — serve stale indexed rows if we have them
  if (graphCooldownRemaining() > 0) {
    const stale = cachedRows(url, STALE_MS);
    if (stale) {
      console.warn("[lga] graph cooldown — using cached policies");
      return stale;
    }
    assertGraphAvailable(); // throws friendly cooling message
  }

  try {
    assertGraphAvailable();
  } catch (e) {
    const stale = cachedRows(url, STALE_MS);
    if (stale) {
      console.warn("[lga] graph cooldown — using cached policies");
      return stale;
    }
    throw e;
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: POLICIES_QUERY }),
    signal: AbortSignal.timeout(20_000),
  });
  noteGraphHttpStatus(res.status);

  if (res.status === 429) {
    // Do NOT retry Studio in-loop — that multiplies free-tier burn
    const stale = cachedRows(url, STALE_MS);
    if (stale) {
      console.warn("[lga] subgraph 429 — using cached policies (no Studio retry)");
      return stale;
    }
    throw new Error(
      "Receipt Graph busy (rate limit) — wait a few seconds and retry",
    );
  }

  if (res.status >= 500) {
    const stale = cachedRows(url, STALE_MS);
    if (stale) {
      console.warn(`[lga] subgraph ${res.status} — using cached policies`);
      return stale;
    }
    throw new Error(`subgraph ${res.status}`);
  }

  if (!res.ok) throw new Error(`subgraph ${res.status}`);

  const json = (await res.json()) as {
    data?: { policies?: PolicyRow[] };
    errors?: unknown;
  };
  if (json.errors) {
    throw new Error(`subgraph errors ${JSON.stringify(json.errors)}`);
  }
  const rows = json.data?.policies ?? [];
  policyCache = { url, at: Date.now(), rows };
  return rows;
}

export function mcpHint(url: string): string {
  return `Subgraph MCP → Clerk NL status on ${url} — ask “what policies are active?” / “recent execution receipts?” (Use Case agent/app, not tooling)`;
}

/** User-facing one-liner from keeper/subgraph errors. */
export function friendlyGraphError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|rate limit|busy|cooling/i.test(msg)) {
    return "Receipt Graph rate-limited — confirm Gateway URL (not Studio) and retry. Fills already on-chain are unaffected.";
  }
  if (/subgraph/i.test(msg)) {
    return "Could not reach Receipt Graph right now.";
  }
  return msg.slice(0, 160);
}
