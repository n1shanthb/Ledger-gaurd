import type { ToolDef } from "./types";

export const TOOL_DEFS: Record<string, ToolDef> = {
  queryReceiptGraphNl: {
    type: "function",
    function: {
      name: "queryReceiptGraphNl",
      description:
        "Subgraph MCP consumer: answer a natural-language Receipt Graph question with live Subgraph Studio data (policies, execution receipts, payment audits). Prefer this over hardcoded list tools for status.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description:
              "Natural language question, e.g. what policies are active? recent execution receipts?",
          },
        },
        required: ["question"],
      },
    },
  },
  listActivePolicies: {
    type: "function",
    function: {
      name: "listActivePolicies",
      description:
        "List active Guardian policies from Receipt Graph (The Graph Studio).",
      parameters: { type: "object", properties: {} },
    },
  },
  getPythSpot: {
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
  compareLendingRisk: {
    type: "function",
    function: {
      name: "compareLendingRisk",
      description:
        "Messari fan-out: safest Base borrow by utilization (USDC/WETH).",
      parameters: {
        type: "object",
        properties: {
          assetSymbol: { type: "string", enum: ["USDC", "WETH"] },
        },
      },
    },
  },
  findDeepestWethPool: {
    type: "function",
    function: {
      name: "findDeepestWethPool",
      description: "Messari DEX fan-out: deepest WETH pool by TVL.",
      parameters: {
        type: "object",
        properties: { crossChain: { type: "boolean" } },
      },
    },
  },
  evaluateSwapGate: {
    type: "function",
    function: {
      name: "evaluateSwapGate",
      description:
        "Gate a Guardian swap using Messari lending util + WETH pool depth.",
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
  proposeGuardianPolicy: {
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
  requestExecutionAttempt: {
    type: "function",
    function: {
      name: "requestExecutionAttempt",
      description:
        "Pay Hedera x402 and POST /trigger. Blocked if gate proceed=false unless user override.",
      parameters: { type: "object", properties: {} },
    },
  },
  getRecentPayments: {
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
};

export function toolsFor(names: string[]): ToolDef[] {
  return names.map((n) => {
    const t = TOOL_DEFS[n];
    if (!t) throw new Error(`unknown tool def ${n}`);
    return t;
  });
}
