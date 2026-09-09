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

type Msg = Record<string, unknown>;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "listActivePolicies",
      description: "List active Guardian policies from Receipt Graph (The Graph Studio).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getPythSpot",
      description: "Live Pyth USD spot for eth or btc.",
      parameters: {
        type: "object",
        properties: { asset: { type: "string", enum: ["eth", "btc"] } },
        required: ["asset"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compareLendingRisk",
      description:
        "Messari fan-out: safest Base borrow by utilization (USDC/WETH). Same decide API as Compose UI.",
      parameters: {
        type: "object",
        properties: {
          assetSymbol: { type: "string", enum: ["USDC", "WETH"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findDeepestWethPool",
      description:
        "Messari DEX fan-out: deepest WETH pool by TVL (Base-first unless crossChain).",
      parameters: {
        type: "object",
        properties: {
          crossChain: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "evaluateSwapGate",
      description:
        "Gate a Guardian swap using Messari lending util + WETH pool depth. Call before requestExecutionAttempt.",
      parameters: {
        type: "object",
        properties: {
          maxUtil: { type: "number" },
          minPoolTvlUsd: { type: "number" },
          assetSymbol: { type: "string" },
          crossChainDex: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeGuardianPolicy",
      description:
        "Propose a policy JSON for Ledger clear-sign. Does not broadcast.",
      parameters: {
        type: "object",
        properties: {
          strategyType: {
            type: "string",
            enum: ["STOP_LOSS", "TAKE_PROFIT", "LP_RANGE", "BUY_DIP"],
          },
          asset: { type: "string" },
          stopLossUsd: { type: "number" },
          takeProfitUsd: { type: "number" },
          amount: { type: "string" },
          maxSlippageBps: { type: "number" },
          reasoning: { type: "string" },
        },
        required: ["strategyType", "asset", "amount", "reasoning"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "requestExecutionAttempt",
      description:
        "Pay Hedera x402 and POST /trigger (Base execute when autopoll off). Prefer evaluateSwapGate first.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getRecentPayments",
      description: "Recent x402 attempts with HashScan / HCS refs.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
];

function ensureGraphKey(secrets: KeeperSecrets) {
  const key = secrets.graphApiKey?.trim() || process.env.GRAPH_API_KEY?.trim();
  if (!key) {
    throw new Error("GRAPH_API_KEY missing from Key Ring / env");
  }
  process.env.GRAPH_API_KEY = key;
}

async function runTool(
  secrets: KeeperSecrets,
  name: string,
  argsJson: string,
): Promise<string> {
  const args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  switch (name) {
    case "listActivePolicies": {
      const policies = await fetchActivePolicies(secrets.graphUrl, secrets.graphApiKey);
      return JSON.stringify(
        policies.map((p: { id: string; policyType: string; stopLossPrice: string; takeProfitPrice: string; maxAmount: string; token: string }) => ({
          id: p.id,
          type: p.policyType,
          stop: Number(p.stopLossPrice) / 1e8,
          take: Number(p.takeProfitPrice) / 1e8,
          maxAmount: p.maxAmount,
          token: p.token,
        })),
      );
    }
    case "getPythSpot": {
      const asset = String(args.asset ?? "eth");
      const feed =
        asset === "btc"
          ? "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
          : ETH_USD;
      const spot = await fetchSpotUsd1e8(feed);
      return JSON.stringify({ asset, usd: Number(spot) / 1e8 });
    }
    case "compareLendingRisk": {
      ensureGraphKey(secrets);
      const d = await decideSafestBorrow({
        assetSymbol: String(args.assetSymbol ?? "USDC"),
        network: "base",
      });
      return JSON.stringify({
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
        runnersUp: d.runnersUp.slice(0, 4).map((m: {
          protocolSlug: string;
          network: string;
          utilization: number | null;
          totalValueLockedUSD: number;
        }) => ({
          protocol: m.protocolSlug,
          network: m.network,
          util: m.utilization,
          tvl: m.totalValueLockedUSD,
        })),
        deploymentsOk: d.deploymentsOk,
      });
    }
    case "findDeepestWethPool": {
      ensureGraphKey(secrets);
      const d = await decideDeepestWethPool({
        baseOnly: !Boolean(args.crossChain),
      });
      return JSON.stringify({
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
      });
    }
    case "evaluateSwapGate": {
      ensureGraphKey(secrets);
      const g = await evaluateSwapGate({
        maxUtil: typeof args.maxUtil === "number" ? args.maxUtil : undefined,
        minPoolTvlUsd:
          typeof args.minPoolTvlUsd === "number"
            ? args.minPoolTvlUsd
            : undefined,
        assetSymbol:
          typeof args.assetSymbol === "string" ? args.assetSymbol : "USDC",
        crossChainDex: Boolean(args.crossChainDex),
      });
      return JSON.stringify({
        proceed: g.proceed,
        reasons: g.reasons,
        lendingVerdict: g.lending.verdict,
        dexVerdict: g.dex.verdict,
      });
    }
    case "proposeGuardianPolicy":
      return JSON.stringify({
        status: "Awaiting Hardware Signer Approval",
        policyParams: args,
        note: "Clear-sign on Ledger — master key never leaves device.",
      });
    case "requestExecutionAttempt":
      return JSON.stringify(await postPaidTrigger(secrets, "trigger"));
    case "getRecentPayments":
      return JSON.stringify(recentPayments(Number(args.limit ?? 10)));
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}

export async function agentChat(
  secrets: KeeperSecrets,
  userMessages: { role: "user" | "assistant"; content: string }[],
): Promise<{ reply: string; toolTrace: string[] }> {
  if (!secrets.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY missing from Key Ring");
  }

  const toolTrace: string[] = [];
  const messages: Msg[] = [
    {
      role: "system",
      content:
        "You are LGA Guardian Agent. Use Receipt Graph + Pyth + Messari fan-out tools. Propose policies for Ledger clear-sign; never claim you signed. Use compareLendingRisk / findDeepestWethPool / evaluateSwapGate before proposing sizeable trades. If evaluateSwapGate says proceed=false, explain and do not call requestExecutionAttempt unless the user explicitly overrides. Base execution requires requestExecutionAttempt (Hedera x402). Master key never leaves Ledger; Key Ring holds keeper secrets.",
    },
    ...userMessages,
  ];

  for (let i = 0; i < 6; i++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secrets.openRouterApiKey}`,
        "content-type": "application/json",
        "HTTP-Referer": "https://github.com/ledgergaurd",
        "X-Title": "LGA Keeper Agent",
      },
      body: JSON.stringify({
        model: secrets.openRouterModel || "openai/gpt-4o-mini",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: {
            id: string;
            type?: string;
            function: { name: string; arguments: string };
          }[];
        };
      }[];
    };
    const msg = json.choices?.[0]?.message;
    if (!msg) throw new Error("openrouter empty");

    if (msg.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });
      for (const tc of msg.tool_calls) {
        toolTrace.push(tc.function.name);
        const out = await runTool(
          secrets,
          tc.function.name,
          tc.function.arguments || "{}",
        );
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: out,
        });
      }
      continue;
    }

    return { reply: msg.content ?? "", toolTrace };
  }

  return { reply: "Stopped after max tool rounds.", toolTrace };
}
