import { randomUUID } from "node:crypto";
import type { KeeperSecrets } from "../ring";
import { postPaidTrigger } from "../paidTrigger";
import {
  createCapabilityBroker,
  publicCapability,
  redactSecrets,
} from "../capabilities";
import type { AgentId, Emit, RunResult } from "./types";
import { runComposer, stickyPropose } from "./composer";
import { runSolver } from "./solver";
import { runClerk } from "./clerk";
import { runPolicyIntake } from "./intake";
import { runTool, type ToolCtx } from "./tools";
import type { PolicyDraft } from "./policyDraft";

function edge(
  emit: Emit,
  runId: string,
  from: AgentId,
  to: AgentId,
  label: string,
) {
  emit({ type: "edge", runId, from, to, label });
}

/** Code-first Messari gate — always before solver explain for risk/execute/full. */
async function ensureSolverGate(opts: {
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
}) {
  if (opts.ctx.gateProceed != null) return;
  opts.emit({
    type: "tool_start",
    runId: opts.runId,
    agent: "solver",
    tool: "evaluateSwapGate",
  });
  opts.toolTrace.push("solver:evaluateSwapGate");
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
    agent: "solver",
    tool: "evaluateSwapGate",
    ok: result.ok,
    summary: result.summary,
  });
}

/** Non-LLM x402 payer — no OpenRouter round. */
async function runPayer(opts: {
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
  secrets: KeeperSecrets;
}): Promise<string> {
  const model = "code:postPaidTrigger";
  opts.emit({
    type: "agent_start",
    runId: opts.runId,
    agent: "payer",
    model,
  });

  const blocked =
    opts.ctx.gateProceed === false && !opts.ctx.overrideExecute;

  if (blocked) {
    const text =
      "Payer: gate proceed=false — not calling postPaidTrigger. Say override if you insist.";
    opts.emit({
      type: "agent_message",
      runId: opts.runId,
      agent: "payer",
      text,
    });
    opts.emit({ type: "agent_end", runId: opts.runId, agent: "payer" });
    return text;
  }

  opts.toolTrace.push("payer:postPaidTrigger");
  opts.emit({
    type: "tool_start",
    runId: opts.runId,
    agent: "payer",
    tool: "postPaidTrigger",
  });
  try {
    const broker = createCapabilityBroker(opts.secrets);
    const cap = broker.mint("pay:trigger", 120_000);
    const paid = await postPaidTrigger(opts.secrets, "trigger", {
      capabilityId: cap.id,
      broker,
      mintInternal: false,
    });
    const summary = `x402 /trigger status=${paid.status} cap=${cap.id}`;
    opts.emit({
      type: "tool_end",
      runId: opts.runId,
      agent: "payer",
      tool: "postPaidTrigger",
      ok: paid.status >= 200 && paid.status < 300,
      summary,
    });
    const pub = publicCapability(cap);
    const text = redactSecrets(
      `Payer paid /trigger → ${paid.status} (capability ${pub.scope} ${pub.id})\n${paid.body.slice(0, 500)}`,
      opts.secrets,
    );
    opts.emit({
      type: "agent_message",
      runId: opts.runId,
      agent: "payer",
      text: text.slice(0, 800),
    });
    opts.emit({ type: "agent_end", runId: opts.runId, agent: "payer" });
    return text;
  } catch (e) {
    const msg = redactSecrets(
      e instanceof Error ? e.message : String(e),
      opts.secrets,
    );
    opts.emit({
      type: "tool_end",
      runId: opts.runId,
      agent: "payer",
      tool: "postPaidTrigger",
      ok: false,
      summary: msg.slice(0, 80),
    });
    opts.emit({
      type: "error",
      runId: opts.runId,
      agent: "payer",
      message: msg,
    });
    opts.emit({ type: "agent_end", runId: opts.runId, agent: "payer" });
    return `Payer error: ${msg}`;
  }
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

  const forcePropose = stickyPropose(opts.userMessages);
  const composed = await runComposer({
    secrets: opts.secrets,
    userText,
    userMessages: opts.userMessages,
    forcePropose,
    emit,
    runId,
  });
  agents.push({
    agent: "composer",
    model: opts.secrets.openRouterModels.composer,
  });

  const ctx: ToolCtx = {
    secrets: opts.secrets,
    gateProceed: null,
    overrideExecute: composed.overrideExecute,
    broker: createCapabilityBroker(opts.secrets),
  };

  const parts: string[] = [];
  const pipe = composed.pipeline;
  let policyDraft: PolicyDraft | null = null;

  const needClerk = pipe === "status" || pipe === "full";
  const needSolver =
    pipe === "risk" || pipe === "execute" || pipe === "full";
  // full = vague mix — still allow pay after gate (same as old broker-on-full)
  const needPayer = pipe === "execute" || pipe === "full";
  const needPropose = pipe === "propose";

  if (needClerk) {
    edge(emit, runId, "composer", "clerk", "Receipt Graph");
    const text = await runClerk({
      secrets: opts.secrets,
      userText,
      brief: composed.note,
      ctx,
      emit,
      runId,
      toolTrace,
    });
    agents.push({
      agent: "clerk",
      model: opts.secrets.openRouterModels.clerk,
    });
    if (text.trim()) parts.push(`**Clerk**\n${text.trim()}`);
  }

  if (needSolver) {
    edge(
      emit,
      runId,
      needClerk ? "clerk" : "composer",
      "solver",
      "Messari + Pyth",
    );
    await ensureSolverGate({ ctx, emit, runId, toolTrace });
    const text = await runSolver({
      secrets: opts.secrets,
      userText,
      brief: composed.note,
      ctx,
      emit,
      runId,
      toolTrace,
    });
    agents.push({
      agent: "solver",
      model: opts.secrets.openRouterModels.solver,
    });
    const gateLine =
      ctx.gateProceed == null
        ? ""
        : `\n\n_Gate ${ctx.gateProceed ? "clear" : "warn"} (Messari decide)._`;
    if (text.trim() || gateLine) {
      parts.push(`**Solver**\n${text.trim()}${gateLine}`);
    }
  }

  if (needPropose) {
    const { draft, text } = await runPolicyIntake({
      secrets: opts.secrets,
      userMessages: opts.userMessages,
      brief: composed.note,
      ctx,
      emit,
      runId,
      toolTrace,
    });
    policyDraft = draft;
    agents.push({
      agent: "composer",
      model: opts.secrets.openRouterModels.composer,
    });
    if (text.trim()) parts.push(`**Policy intake**\n${text.trim()}`);
  }

  if (needPayer) {
    edge(
      emit,
      runId,
      needSolver ? "solver" : "composer",
      "payer",
      ctx.gateProceed === false && !ctx.overrideExecute
        ? "gate blocked"
        : "x402 path",
    );
    const text = await runPayer({
      ctx,
      emit,
      runId,
      toolTrace,
      secrets: opts.secrets,
    });
    agents.push({ agent: "payer", model: "code:postPaidTrigger" });
    if (text.trim()) parts.push(`**Payer**\n${text.trim()}`);

    // Driver lights when pay was attempted (Base fill runs inside /trigger handler).
    if (!text.startsWith("Payer: gate")) {
      edge(emit, runId, "payer", "driver", "Base session fill");
      emit({
        type: "agent_start",
        runId,
        agent: "driver",
        model: "code:executePolicy",
      });
      emit({
        type: "agent_message",
        runId,
        agent: "driver",
        text: text.startsWith("Payer error")
          ? "Driver: pay failed — no Base fill."
          : "Driver: /trigger path — session-key fill on Base when bands hit (see keeper Driver logs).",
      });
      emit({ type: "agent_end", runId, agent: "driver" });
      agents.push({ agent: "driver", model: "code:executePolicy" });
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
    policyDraft,
  };
}
