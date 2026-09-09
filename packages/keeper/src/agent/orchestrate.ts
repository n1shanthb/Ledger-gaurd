import { randomUUID } from "node:crypto";
import type { KeeperSecrets } from "../ring";
import type { AgentId, Emit, RunResult } from "./types";
import { runCoordinator } from "./coordinator";
import { runSentinel } from "./sentinel";
import { runOracle } from "./oracle";
import { runBroker } from "./broker";
import { runTool, type ToolCtx } from "./tools";

function edge(
  emit: Emit,
  runId: string,
  from: AgentId,
  to: AgentId,
  label: string,
) {
  emit({ type: "edge", runId, from, to, label });
}

/** If Oracle skipped tools, still run Messari gate in-process (real data, real events). */
async function ensureOracleGate(opts: {
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
}) {
  if (opts.ctx.gateProceed != null) return;
  opts.emit({
    type: "tool_start",
    runId: opts.runId,
    agent: "oracle",
    tool: "evaluateSwapGate",
  });
  opts.toolTrace.push("oracle:evaluateSwapGate");
  const result = await runTool(opts.ctx, "evaluateSwapGate", "{}");
  if (typeof result.gateProceed === "boolean") {
    opts.ctx.gateProceed = result.gateProceed;
  }
  let reasons: string[] = [];
  try {
    const parsed = JSON.parse(result.out) as { reasons?: string[] };
    if (Array.isArray(parsed.reasons)) reasons = parsed.reasons;
  } catch {
    /* ignore */
  }
  if (typeof result.gateProceed === "boolean") {
    opts.emit({
      type: "gate",
      runId: opts.runId,
      proceed: result.gateProceed,
      reasons,
    });
  }
  opts.emit({
    type: "tool_end",
    runId: opts.runId,
    agent: "oracle",
    tool: "evaluateSwapGate",
    ok: result.ok,
    summary: result.summary,
  });
}

export async function orchestrate(opts: {
  secrets: KeeperSecrets;
  userMessages: { role: "user" | "assistant"; content: string }[];
  emit?: Emit;
}): Promise<RunResult> {
  if (!opts.secrets.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY missing from Key Ring");
  }

  const runId = randomUUID().slice(0, 8);
  const toolTrace: string[] = [];
  const agents: { agent: AgentId; model: string }[] = [];
  const emit: Emit = (ev) => {
    opts.emit?.(ev);
  };

  const userText = [...opts.userMessages]
    .reverse()
    .find((m) => m.role === "user")?.content;
  if (!userText?.trim()) throw new Error("user message required");

  emit({ type: "run_start", runId });

  const coord = await runCoordinator({
    secrets: opts.secrets,
    userText,
    emit,
    runId,
  });
  agents.push({
    agent: "coordinator",
    model: opts.secrets.openRouterModels.coordinator,
  });

  const ctx: ToolCtx = {
    secrets: opts.secrets,
    gateProceed: null,
    overrideExecute: coord.overrideExecute,
  };

  const parts: string[] = [];
  const pipe = coord.pipeline;

  const needSentinel =
    pipe === "status" || pipe === "propose" || pipe === "full";
  const needOracle =
    pipe === "risk" ||
    pipe === "execute" ||
    pipe === "propose" ||
    pipe === "full";
  const needBroker =
    pipe === "execute" || pipe === "propose" || pipe === "full";

  if (needSentinel) {
    edge(emit, runId, "coordinator", "sentinel", "Receipt Graph");
    const text = await runSentinel({
      secrets: opts.secrets,
      userText,
      brief: coord.note,
      ctx,
      emit,
      runId,
      toolTrace,
    });
    agents.push({
      agent: "sentinel",
      model: opts.secrets.openRouterModels.sentinel,
    });
    if (text.trim()) parts.push(`**Sentinel**\n${text.trim()}`);
  }

  if (needOracle) {
    edge(
      emit,
      runId,
      needSentinel ? "sentinel" : "coordinator",
      "oracle",
      "Messari + Pyth",
    );
    const text = await runOracle({
      secrets: opts.secrets,
      userText,
      brief: coord.note,
      ctx,
      emit,
      runId,
      toolTrace,
    });
    await ensureOracleGate({ ctx, emit, runId, toolTrace });
    agents.push({
      agent: "oracle",
      model: opts.secrets.openRouterModels.oracle,
    });
    const gateLine =
      ctx.gateProceed == null
        ? ""
        : `\n\n_Gate ${ctx.gateProceed ? "clear" : "warn"} (Messari decide)._`;
    if (text.trim() || gateLine) {
      parts.push(`**Oracle**\n${text.trim()}${gateLine}`);
    }
  }

  if (needBroker) {
    const blockExecute =
      (pipe === "execute" || pipe === "full") &&
      ctx.gateProceed === false &&
      !ctx.overrideExecute;

    if (blockExecute) {
      edge(emit, runId, "oracle", "broker", "gate blocked");
      emit({
        type: "agent_start",
        runId,
        agent: "broker",
        model: opts.secrets.openRouterModels.broker,
      });
      const blocked =
        "Broker: gate proceed=false — not calling requestExecutionAttempt. Say override if you insist.";
      emit({ type: "agent_message", runId, agent: "broker", text: blocked });
      emit({ type: "agent_end", runId, agent: "broker" });
      agents.push({
        agent: "broker",
        model: opts.secrets.openRouterModels.broker,
      });
      parts.push(`**Broker**\n${blocked}`);
    } else {
      edge(
        emit,
        runId,
        needOracle ? "oracle" : needSentinel ? "sentinel" : "coordinator",
        "broker",
        pipe === "propose" ? "propose policy" : "x402 path",
      );
      const text = await runBroker({
        secrets: opts.secrets,
        userText,
        brief: `${coord.note} | gateProceed=${ctx.gateProceed}`,
        ctx,
        emit,
        runId,
        toolTrace,
        proposeOnly: pipe === "propose",
      });
      agents.push({
        agent: "broker",
        model: opts.secrets.openRouterModels.broker,
      });
      if (text.trim()) parts.push(`**Broker**\n${text.trim()}`);
    }
  }

  const reply =
    parts.join("\n\n") ||
    "No specialist output — try rephrasing (status / risk / execute).";
  emit({ type: "run_end", runId, reply });

  return {
    reply,
    toolTrace,
    runId,
    pipeline: pipe,
    agents,
    gateProceed: ctx.gateProceed,
  };
}
