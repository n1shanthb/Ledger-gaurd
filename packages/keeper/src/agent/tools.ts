import type { KeeperSecrets } from "../ring";
import { fetchActivePolicies } from "../subgraph";
import { fetchSpotUsd1e8, ETH_USD } from "../pyth";
import { recentPayments } from "../payments";
import { postPaidTrigger } from "../paidTrigger";
import {
  decideSafestBorrow,
  decideDeepestWethPool,
  evaluateSwapGate,
} from "@lga/graph-data";
import { queryReceiptGraphNl } from "./subgraphMcp";
import {
  createCapabilityBroker,
  publicCapability,
  redactSecrets,
  stampCapability,
  type CapabilityBroker,
} from "../capabilities";

export type ToolCtx = {
  secrets: KeeperSecrets;
  gateProceed: boolean | null;
  overrideExecute: boolean;
  broker?: CapabilityBroker;
};

export type ToolResult = {
  out: string;
  summary: string;
  ok: boolean;
  gateProceed?: boolean;
};

function ensureGraphKey(secrets: KeeperSecrets) {
  const key = secrets.graphApiKey?.trim() || process.env.GRAPH_API_KEY?.trim();
  if (!key) throw new Error("GRAPH_API_KEY missing from Key Ring / env");
  process.env.GRAPH_API_KEY = key;
}

function brokerOf(ctx: ToolCtx): CapabilityBroker {
  return ctx.broker ?? createCapabilityBroker(ctx.secrets);
}

/** Stamp read scope before Graph/Pyth tool work (in-process; not an agent RPC). */
function stampRead(ctx: ToolCtx, scope: "read:graph" | "read:pyth") {
  return stampCapability(brokerOf(ctx), scope, 60_000);
}

export async function runTool(
  ctx: ToolCtx,
  name: string,
  argsJson: string,
): Promise<ToolResult> {
  const args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  try {
    switch (name) {
      case "queryReceiptGraphNl": {
        stampRead(ctx, "read:graph");
        const question = String(args.question ?? "").trim();
        if (!question) {
          return {
            out: JSON.stringify({ error: "question required" }),
            summary: "missing question",
            ok: false,
          };
        }
        const result = await queryReceiptGraphNl(ctx.secrets, question);
        const summary =
          result.kind === "policies"
            ? `mcp policies ${(result.data as { policies?: unknown[] })?.policies?.length ?? 0}`
            : result.kind === "receipts"
              ? `mcp receipts ${(result.data as { executionReceipts?: unknown[] })?.executionReceipts?.length ?? 0}`
              : result.kind === "audits"
                ? `mcp audits ${(result.data as { paymentAudits?: unknown[] })?.paymentAudits?.length ?? 0}`
                : "mcp status";
        return {
          out: JSON.stringify(result),
          summary,
          ok: true,
        };
      }
      case "listActivePolicies": {
        stampRead(ctx, "read:graph");
        const policies = await fetchActivePolicies(
          ctx.secrets.graphUrl,
          ctx.secrets.graphApiKey,
        );
        const rows = policies.map(
          (p: {
            id: string;
            policyType: string;
            stopLossPrice: string;
            takeProfitPrice: string;
            maxAmount: string;
            token: string;
          }) => ({
            id: p.id,
            type: p.policyType,
            stop: Number(p.stopLossPrice) / 1e8,
            take: Number(p.takeProfitPrice) / 1e8,
            maxAmount: p.maxAmount,
            token: p.token,
          }),
        );
        return {
          out: JSON.stringify(rows),
          summary: `${rows.length} policies`,
          ok: true,
        };
      }
      case "getPythSpot": {
        stampRead(ctx, "read:pyth");
        const asset = String(args.asset ?? "eth");
        const feed =
          asset === "btc"
            ? "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
            : ETH_USD;
        const spot = await fetchSpotUsd1e8(feed);
        const usd = Number(spot) / 1e8;
        return {
          out: JSON.stringify({ asset, usd }),
          summary: `${asset} $${usd.toFixed(2)}`,
          ok: true,
        };
      }
      case "compareLendingRisk": {
        stampRead(ctx, "read:graph");
        ensureGraphKey(ctx.secrets);
        const d = await decideSafestBorrow({
          assetSymbol: String(args.assetSymbol ?? "USDC"),
          network: "base",
          snappy: true,
        });
        return {
          out: JSON.stringify({
            verdict: d.verdict,
            winner: d.winner
              ? {
                  protocol: d.winner.protocolSlug,
                  network: d.winner.network,
                  asset: d.winner.assetSymbol,
                  util: d.winner.utilization,
                  tvl: d.winner.totalValueLockedUSD,
                }
              : null,
            deploymentsOk: d.deploymentsOk,
          }),
          summary: d.verdict.slice(0, 80),
          ok: true,
        };
      }
      case "findDeepestWethPool": {
        stampRead(ctx, "read:graph");
        ensureGraphKey(ctx.secrets);
        const d = await decideDeepestWethPool({
          baseOnly: !Boolean(args.crossChain),
          snappy: true,
        });
        return {
          out: JSON.stringify({
            verdict: d.verdict,
            winner: d.winner
              ? {
                  pair: d.winner.pairLabel,
                  protocol: d.winner.protocolSlug,
                  network: d.winner.network,
                  tvl: d.winner.totalValueLockedUSD,
                }
              : null,
            deploymentsOk: d.deploymentsOk,
          }),
          summary: d.verdict.slice(0, 80),
          ok: true,
        };
      }
      case "evaluateSwapGate": {
        stampRead(ctx, "read:graph");
        ensureGraphKey(ctx.secrets);
        const g = await evaluateSwapGate({
          maxUtil: typeof args.maxUtil === "number" ? args.maxUtil : undefined,
          minPoolTvlUsd:
            typeof args.minPoolTvlUsd === "number"
              ? args.minPoolTvlUsd
              : undefined,
          assetSymbol:
            typeof args.assetSymbol === "string" ? args.assetSymbol : "USDC",
          crossChainDex: Boolean(args.crossChainDex),
          snappy: true,
        });
        return {
          out: JSON.stringify({
            proceed: g.proceed,
            reasons: g.reasons,
            lendingVerdict: g.lending.verdict,
            dexVerdict: g.dex.verdict,
          }),
          summary: g.proceed ? "gate clear" : "gate warn",
          ok: true,
          gateProceed: g.proceed,
        };
      }
      case "proposeGuardianPolicy":
        return {
          out: JSON.stringify({
            status: "Awaiting Hardware Signer Approval",
            policyParams: args,
            note: "Clear-sign on Ledger — master key never leaves device.",
          }),
          summary: "policy proposal (HITL)",
          ok: true,
        };
      case "requestExecutionAttempt": {
        if (ctx.gateProceed === false && !ctx.overrideExecute) {
          return {
            out: JSON.stringify({
              error: "blocked",
              reason:
                "evaluateSwapGate proceed=false — user must explicitly override",
            }),
            summary: "execute blocked by gate",
            ok: false,
          };
        }
        const broker = createCapabilityBroker(ctx.secrets);
        const cap = broker.mint("pay:trigger", 120_000);
        const paid = await postPaidTrigger(ctx.secrets, "trigger", {
          capabilityId: cap.id,
          broker,
          mintInternal: false,
        });
        return {
          out: redactSecrets(
            JSON.stringify({
              status: paid.status,
              body: paid.body.slice(0, 400),
              hashscanUrl: paid.hashscanUrl,
              capability: publicCapability(cap),
            }),
            ctx.secrets,
          ),
          summary: "x402 /trigger via capability",
          ok: true,
        };
      }
      case "getRecentPayments":
        return {
          out: JSON.stringify(recentPayments(Number(args.limit ?? 10))),
          summary: "payments listed",
          ok: true,
        };
      default:
        return {
          out: JSON.stringify({ error: `unknown tool ${name}` }),
          summary: "unknown tool",
          ok: false,
        };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      out: JSON.stringify({ error: msg }),
      summary: msg.slice(0, 80),
      ok: false,
    };
  }
}
