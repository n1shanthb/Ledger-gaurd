export function getGraphApiKey(): string {
  const key =
    process.env.NEXT_PUBLIC_GRAPH_API_KEY?.trim() ||
    process.env.GRAPH_API_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "GRAPH_API_KEY or NEXT_PUBLIC_GRAPH_API_KEY required for Graph Gateway",
    );
  }
  return key;
}

export function gatewayUrl(deploymentId: string, apiKey?: string): string {
  const key = apiKey ?? getGraphApiKey();
  return `https://gateway.thegraph.com/api/${key}/subgraphs/id/${deploymentId}`;
}

export function getReceiptGraphUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUBGRAPH_QUERY_URL?.trim() ||
    process.env.SUBGRAPH_QUERY_URL?.trim() ||
    "https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4"
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type GqlErrorBody = {
  data?: unknown;
  errors?: { message: string }[];
};

export async function requestWithRetry<T>(
  url: string,
  document: string,
  variables?: Record<string, unknown>,
  opts?: {
    maxAttempts?: number;
    baseMs?: number;
    timeoutMs?: number;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 2;
  const baseMs = opts?.baseMs ?? 400;
  const timeoutMs = opts?.timeoutMs ?? 18_000;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(opts?.headers ?? {}),
        },
        body: JSON.stringify({ query: document, variables }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`gateway http ${res.status}`);
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`gateway http ${res.status}: ${text.slice(0, 200)}`);
      }

      const json = (await res.json()) as GqlErrorBody;
      if (json.errors?.length) {
        throw new Error(json.errors[0]?.message ?? "graphql error");
      }
      if (json.data == null) throw new Error("gateway empty data");
      return json.data as T;
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts - 1) break;
      const jitter = Math.floor(Math.random() * 100);
      await sleep(baseMs * 2 ** attempt + jitter);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function gatewayRequest<T>(
  deploymentId: string,
  document: string,
  variables?: Record<string, unknown>,
  opts?: {
    maxAttempts?: number;
    timeoutMs?: number;
    baseMs?: number;
  },
): Promise<T> {
  return requestWithRetry<T>(
    gatewayUrl(deploymentId),
    document,
    variables,
    opts,
  );
}
