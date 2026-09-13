/**
 * Subgraph MCP consumer path for Receipt Clerk.
 * LGA is the Use Case agent/app — not a standalone tooling MCP product.
 */
import type { KeeperSecrets } from "../ring";
import { assertGraphAvailable, noteGraphHttpStatus } from "../graphGuard";

export type McpQueryKind = "policies" | "receipts" | "audits" | "status";

const QUERIES: Record<McpQueryKind, string> = {
  policies: `{
  policies(where: { active: true }, first: 20) {
    id owner token policyType stopLossPrice takeProfitPrice maxAmount maxSlippageBps
  }
}`,
  receipts: `{
  executionReceipts(first: 10, orderBy: timestamp, orderDirection: desc) {
    triggerType pythPrice executionPrice compliant txHash timestamp
  }
}`,
  audits: `{
  paymentAudits(first: 10, orderBy: timestamp, orderDirection: desc) {
    attemptId hcsRef hederaPaymentRef baseTx timestamp
  }
}`,
  status: `{
  policies(where: { active: true }, first: 20) {
    id token policyType stopLossPrice takeProfitPrice maxAmount
  }
  executionReceipts(first: 5, orderBy: timestamp, orderDirection: desc) {
    triggerType pythPrice compliant txHash timestamp
  }
  paymentAudits(first: 5, orderBy: timestamp, orderDirection: desc) {
    attemptId hcsRef baseTx
  }
}`,
};

export function classifyReceiptQuestion(question: string): McpQueryKind {
  const q = question.toLowerCase();
  if (
    /\b(receipt|execution|fill|filled|txhash|compliant)\b/.test(q) &&
    !/\bpolic/.test(q)
  ) {
    return "receipts";
  }
  if (/\b(payment|audit|hcs|x402|hedera|agent id|agent identity|who paid)\b/.test(q)) {
    return "audits";
  }
  if (/\b(polic|active|stop.?loss|take.?profit|guardian)\b/.test(q)) {
    return "policies";
  }
  return "status";
}

export type SubgraphMcpResult = {
  source: "subgraph-mcp-consumer";
  pitch: string;
  studioUrl: string;
  question: string;
  kind: McpQueryKind;
  graphql: string;
  data: unknown;
};

export async function queryReceiptGraphNl(
  secrets: KeeperSecrets,
  question: string,
): Promise<SubgraphMcpResult> {
  assertGraphAvailable();

  const url = secrets.graphUrl?.trim();
  if (!url) throw new Error("SUBGRAPH_QUERY_URL missing from Key Ring / env");
  const apiKey =
    secrets.graphApiKey?.trim() || process.env.GRAPH_API_KEY?.trim();
  if (!apiKey) throw new Error("GRAPH_API_KEY missing from Key Ring / env");

  const kind = classifyReceiptQuestion(question);
  const graphql = QUERIES[kind];
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: graphql }),
    signal: AbortSignal.timeout(20_000),
  });
  noteGraphHttpStatus(res.status);
  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? "Receipt Graph hit The Graph Studio free-tier rate limit — wait ~30–45s."
        : `subgraph-mcp studio ${res.status}`,
    );
  }
  const json = (await res.json()) as {
    data?: unknown;
    errors?: unknown;
  };
  if (json.errors) {
    throw new Error(`subgraph-mcp errors ${JSON.stringify(json.errors)}`);
  }
  return {
    source: "subgraph-mcp-consumer",
    pitch:
      kind === "audits"
        ? "Receipt Graph PaymentAudit bridges Hedera (hcsRef / hederaPaymentRef) ↔ Base — Clerk reads both planes"
        : "LGA Use Case agent/app — Clerk consumes live Receipt Graph via Subgraph MCP path",
    studioUrl: url,
    question,
    kind,
    graphql: graphql.replace(/\s+/g, " ").trim(),
    data: json.data ?? null,
  };
}
