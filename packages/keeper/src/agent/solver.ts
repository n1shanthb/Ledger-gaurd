import type { KeeperSecrets } from "../ring";
import type { Emit, Evidence } from "./types";
import { toolsFor } from "./toolDefs";
import { openRouterRound, runSpecialistLoop } from "./openrouter";
import {
  runMarketTool,
  type MarketToolName,
  type ToolCtx,
} from "./tools";
import {
  suggestStopUsd,
  withDraftStatus,
  type PolicyDraft,
} from "./policyDraft";

/** Explain-only tools — gate already ran in-process via ensureSolverGate. */
const ALLOW = new Set<MarketToolName>([
  "getPythSpot",
  "compareLendingRisk",
  "findDeepestWethPool",
]);

function marketExec(ctx: ToolCtx) {
  return (name: string, args: string) => {
    if (
      name === "queryReceiptGraphNl" ||
      name === "listActivePolicies" ||
      name === "getRecentPayments"
    ) {
      return Promise.resolve({
        out: JSON.stringify({ error: "Receipt Graph is Clerk-only" }),
        summary: "clerk-only",
        ok: false,
      });
    }
    if (
      name !== "getPythSpot" &&
      name !== "compareLendingRisk" &&
      name !== "findDeepestWethPool" &&
      name !== "evaluateSwapGate" &&
      name !== "proposeGuardianPolicy" &&
      name !== "requestExecutionAttempt"
    ) {
      return Promise.resolve({
        out: JSON.stringify({ error: `solver cannot run ${name}` }),
        summary: "disallowed",
        ok: false,
      });
    }
    return runMarketTool(ctx, name as MarketToolName, args);
  };
}

export async function runSolver(opts: {
  secrets: KeeperSecrets;
  userText: string;
  brief: string;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
}): Promise<string> {
  const gateHint =
    opts.ctx.gateProceed == null
      ? "Gate not set."
      : opts.ctx.gateProceed
        ? "Gate proceed=true (code-first evaluateSwapGate already ran)."
        : "Gate proceed=false (code-first evaluateSwapGate already ran).";

  return runSpecialistLoop({
    secrets: opts.secrets,
    agent: "solver",
    model: opts.secrets.openRouterModels.solver,
    system: `You are LGA's Market Solver — a helpful risk teammate, not a lecture bot.
${gateHint}
Talk like a sharp friend: clear, warm, specific.
Rules:
- evaluateSwapGate already ran — do NOT call it again.
- Answer what they asked. Use tools when useful (getPythSpot, compareLendingRisk, findDeepestWethPool).
- Keep it to a short paragraph (about 3–5 sentences). No numbered essays, no markdown headers, no JSON/URLs.
- Never execute x402. Never claim Ledger signed.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Composer note: ${opts.brief}` : ""}`,
    userContent: `${opts.userText}

Reply helpfully and briefly.`,
    tools: toolsFor([...ALLOW]),
    allow: new Set(ALLOW),
    ctx: opts.ctx,
    executeTool: marketExec(opts.ctx),
    emit: opts.emit,
    runId: opts.runId,
    toolTrace: opts.toolTrace,
    forceToolsFirst: false,
  });
}

export type AdviseSuggest = {
  draft: PolicyDraft;
  cta: string;
};

export type AdviseResult = {
  text: string;
  evidence: Evidence[];
  suggest?: AdviseSuggest;
};

async function toolOnce(
  opts: {
    ctx: ToolCtx;
    emit: Emit;
    runId: string;
    toolTrace: string[];
  },
  tool: MarketToolName,
  args: string,
) {
  opts.emit({
    type: "tool_start",
    runId: opts.runId,
    agent: "solver",
    tool,
  });
  opts.toolTrace.push(`solver:${tool}`);
  const result = await runMarketTool(opts.ctx, tool, args);
  opts.emit({
    type: "tool_end",
    runId: opts.runId,
    agent: "solver",
    tool,
    ok: result.ok,
    summary: result.summary,
  });
  return result;
}

/** Advise path: parallel market read + optional phrasing-gated suggest. */
export async function runAdviseSolver(opts: {
  secrets: KeeperSecrets;
  userText: string;
  brief: string;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
  wantSuggest: boolean;
  amountHint?: string;
}): Promise<AdviseResult> {
  const model = opts.secrets.openRouterModels.solver;
  opts.emit({
    type: "agent_start",
    runId: opts.runId,
    agent: "solver",
    model,
  });

  const evidence: Evidence[] = [];
  let spotUsd: number | null = null;

  const [spotRes, lendRes, depthRes] = await Promise.all([
    toolOnce(opts, "getPythSpot", JSON.stringify({ asset: "eth" })),
    toolOnce(opts, "compareLendingRisk", JSON.stringify({ assetSymbol: "USDC" })),
    toolOnce(opts, "findDeepestWethPool", JSON.stringify({})),
  ]);

  try {
    const j = JSON.parse(spotRes.out) as { usd?: number };
    if (typeof j.usd === "number" && j.usd > 0) {
      spotUsd = j.usd;
      evidence.push({
        label: "ETH spot",
        value: `$${j.usd.toFixed(2)}`,
        source: "pyth",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const j = JSON.parse(lendRes.out) as {
      verdict?: string;
      winner?: { protocol?: string };
    };
    evidence.push({
      label: "Lending",
      value: j.winner?.protocol
        ? `${j.verdict ?? "ok"} · ${j.winner.protocol}`
        : j.verdict ?? (lendRes.ok ? "ok" : "unavailable"),
      source: "messari",
    });
  } catch {
    evidence.push({
      label: "Lending",
      value: lendRes.summary ?? "unavailable",
      source: "messari",
    });
  }

  try {
    const j = JSON.parse(depthRes.out) as {
      winner?: { pair?: string; tvl?: string | number };
    };
    const tvl =
      j.winner?.tvl != null
        ? ` · TVL $${Number(j.winner.tvl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : "";
    evidence.push({
      label: "WETH pool",
      value: j.winner?.pair ? `${j.winner.pair}${tvl}` : depthRes.summary ?? "—",
      source: "dex",
    });
  } catch {
    evidence.push({
      label: "WETH pool",
      value: depthRes.summary ?? "unavailable",
      source: "dex",
    });
  }

  if (opts.ctx.gateProceed != null) {
    evidence.push({
      label: "Swap gate",
      value: opts.ctx.gateProceed ? "clear" : "caution",
      source: "gate",
    });
  }

  const gateHint =
    opts.ctx.gateProceed == null
      ? "Gate not set."
      : opts.ctx.gateProceed
        ? "Gate proceed=true."
        : "Gate proceed=false.";

  const evidenceBlock = evidence
    .map((e) => `- ${e.label}: ${e.value} (${e.source})`)
    .join("\n");

  let text =
    "Here’s the market snapshot from the tools above — ask if you want a protection draft.";
  try {
    const raw = await openRouterRound({
      apiKey: opts.secrets.openRouterApiKey,
      model,
      messages: [
        {
          role: "system",
          content: `You are LGA's Market Solver — a helpful risk teammate.
${gateHint}
Evidence already gathered (do not invent numbers):
${evidenceBlock}

Rules:
- 3–5 short sentences, plain English. No markdown headers, no JSON/URLs.
- Explain using the evidence. Never execute x402. Never claim Ledger signed.
- ${
            opts.wantSuggest
              ? "User asked a decision question — end by saying a protection draft CTA will appear; do not invent form fields in prose."
              : "User asked an explain/compare question — do NOT pitch a protect-now CTA or draft."
          }
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Composer note: ${opts.brief}` : ""}`,
        },
        { role: "user", content: opts.userText },
      ],
    });
    if (raw.content?.trim()) text = raw.content.trim().slice(0, 600);
  } catch {
    /* fallback */
  }

  opts.emit({
    type: "agent_message",
    runId: opts.runId,
    agent: "solver",
    text: text.slice(0, 400),
  });
  opts.emit({ type: "agent_end", runId: opts.runId, agent: "solver" });

  let suggest: AdviseSuggest | undefined;
  if (opts.wantSuggest && spotUsd != null && spotUsd > 0) {
    const stop = suggestStopUsd(spotUsd, 6);
    const draft = withDraftStatus({
      status: "need_input",
      questions: [],
      suggestions: [
        `Suggested stop ~6% below spot $${spotUsd.toFixed(2)} → $${stop}`,
      ],
      primary: {
        strategyType: "STOP_LOSS",
        asset: "WETH",
        amount: opts.amountHint?.trim() ?? "",
        stopLossUsd: stop,
        maxSlippageBps: 100,
        reasoning: "advise suggest from Pyth spot",
      },
    });
    suggest = {
      draft,
      cta: `Protect ETH at -6% (≈$${stop})?`,
    };
  }

  return { text, evidence, suggest };
}
