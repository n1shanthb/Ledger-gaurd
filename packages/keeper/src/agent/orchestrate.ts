import { randomUUID } from "node:crypto";
import type { KeeperSecrets } from "../ring";
import { postPaidTrigger } from "../paidTrigger";
import {
  createCapabilityBroker,
  redactSecrets,
} from "../capabilities";
import type {
  AgentAction,
  AgentEvent,
  AgentId,
  Emit,
  Pipeline,
  RunResult,
  UiState,
} from "./types";
import {
  runComposer,
  stickyPropose,
  isGreeting,
  isDecisionPhrase,
} from "./composer";
import { runAdviseSolver } from "./solver";
import { runClerk } from "./clerk";
import { runPolicyIntake } from "./intake";
import { runMarketTool, type ToolCtx } from "./tools";
import {
  patchDraft,
  patchFromUserText,
  withDraftStatus,
  type PolicyDraft,
} from "./policyDraft";
import { openRouterRound } from "./openrouter";

function edge(
  emit: Emit,
  runId: string,
  from: AgentId,
  to: AgentId,
  label: string,
) {
  emit({ type: "edge", runId, from, to, label });
}

type PipeIo = {
  secrets: KeeperSecrets;
  userText: string;
  userMessages: { role: "user" | "assistant"; content: string }[];
  brief: string;
  overrideExecute: boolean;
  uiState: UiState | null;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
  agents: { agent: AgentId; model: string }[];
};

type PipeOut = {
  text: string;
  action: AgentAction;
  policyDraft?: PolicyDraft | null;
};

/** Code-first Messari gate — always before solver explain for advise/execute. */
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
  const result = await runMarketTool(opts.ctx, "evaluateSwapGate", "{}");
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
      "Skipped pay — risk gate is not clear. Say “override” only if you insist.";
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
      agentId: "payer",
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
    const ok = paid.status >= 200 && paid.status < 300;
    let bodyErr = "";
    try {
      const body = JSON.parse(paid.body) as { error?: string };
      if (body.error) bodyErr = body.error;
    } catch {
      /* ignore */
    }
    const busy = /429|rate limit|busy|Receipt Graph/i.test(bodyErr);
    const text = !ok
      ? busy
        ? "Receipt Graph is busy (rate limit). Wait a few seconds, then try again — no fill claimed."
        : bodyErr
          ? `Pay failed: ${bodyErr.replace(/^Error:\s*/i, "").slice(0, 100)}. No fill claimed.`
          : `Pay attempt returned ${paid.status}. No fill claimed.`
      : "Paid the keeper trigger. That is a payment — not a fill. Check Activity if a band was hit.";
    opts.emit({
      type: "agent_message",
      runId: opts.runId,
      agent: "payer",
      text: !ok
        ? busy
          ? "Graph busy — retry shortly"
          : "Pay failed"
        : "Paid /trigger — payment only, not a fill.",
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
    return `Pay failed — ${msg.slice(0, 120)}`;
  }
}

async function runChitchat(io: PipeIo): Promise<PipeOut> {
  let reply =
    "Hey — happy to help with protections, status, or risk whenever you want.";
  try {
    const raw = await openRouterRound({
      apiKey: io.secrets.openRouterApiKey,
      model: io.secrets.openRouterModels.composer,
      messages: [
        {
          role: "system",
          content: `You are LGA's friendly protection assistant.
Reply in 1–2 warm sentences. Sound human.
Never dump JSON, URLs, rate limits, or pipeline names.
Master key never leaves Ledger; Key Ring holds keeper secrets.`,
        },
        { role: "user", content: io.userText },
      ],
    });
    if (raw.content?.trim()) reply = raw.content.trim().slice(0, 320);
  } catch {
    /* keep fallback */
  }
  io.emit({
    type: "agent_message",
    runId: io.runId,
    agent: "composer",
    text: reply,
  });
  return { text: reply, action: { type: "none" } };
}

/** ONLY pipeline that may construct/call Clerk + Receipt Graph MCP. */
async function runStatus(io: PipeIo): Promise<PipeOut> {
  edge(io.emit, io.runId, "composer", "clerk", "Receipt Graph");
  const text = await runClerk({
    secrets: io.secrets,
    userText: io.userText,
    brief: io.brief,
    ctx: io.ctx,
    emit: io.emit,
    runId: io.runId,
    toolTrace: io.toolTrace,
  });
  io.agents.push({
    agent: "clerk",
    model: io.secrets.openRouterModels.clerk,
  });
  return { text: clipPart(text), action: { type: "none" } };
}

async function runAdvise(io: PipeIo): Promise<PipeOut> {
  edge(io.emit, io.runId, "composer", "solver", "gate");
  await ensureSolverGate({
    ctx: io.ctx,
    emit: io.emit,
    runId: io.runId,
    toolTrace: io.toolTrace,
  });
  io.agents.push({ agent: "solver", model: "code:evaluateSwapGate" });

  const decided = isDecisionPhrase(io.userText);
  const advised = await runAdviseSolver({
    secrets: io.secrets,
    userText: io.userText,
    brief: io.brief,
    ctx: io.ctx,
    emit: io.emit,
    runId: io.runId,
    toolTrace: io.toolTrace,
    wantSuggest: decided,
    amountHint: io.uiState?.draft?.amount ?? "",
  });
  io.agents.push({
    agent: "solver",
    model: io.secrets.openRouterModels.solver,
  });

  const gateBit =
    io.ctx.gateProceed == null
      ? ""
      : io.ctx.gateProceed
        ? " Gate clear."
        : " Gate caution.";

  const action: AgentAction =
    decided && advised.suggest
      ? {
          type: "suggest_policy",
          payload: {
            draft: advised.suggest.draft,
            cta: advised.suggest.cta,
            evidence: advised.evidence,
          },
        }
      : advised.evidence.length > 0
        ? {
            type: "show_evidence",
            payload: { evidence: advised.evidence },
          }
        : { type: "none" };

  return {
    text: clipPart((advised.text.trim() + gateBit).trim(), 420),
    action,
  };
}

async function runPropose(io: PipeIo): Promise<PipeOut> {
  const { draft, text } = await runPolicyIntake({
    secrets: io.secrets,
    userMessages: io.userMessages,
    brief: io.brief,
    ctx: io.ctx,
    emit: io.emit,
    runId: io.runId,
    toolTrace: io.toolTrace,
  });
  io.agents.push({
    agent: "composer",
    model: io.secrets.openRouterModels.composer,
  });
  return {
    text: clipPart(text),
    action: {
      type: "open_form",
      payload: { kind: draft.primary.strategyType, draft },
    },
    policyDraft: draft,
  };
}

async function runModify(io: PipeIo): Promise<PipeOut> {
  if (!io.uiState?.formOpen || !io.uiState.draft) {
    return {
      text: "Open a draft first, then tell me what to change.",
      action: { type: "none" },
    };
  }

  const patch = patchFromUserText(io.userText, io.uiState.draft);
  if (Object.keys(patch).length === 0) {
    return {
      text: "Tell me which field to change — amount, stop price, or slippage.",
      action: { type: "none" },
    };
  }

  // Build a draft shell from uiState for summary; patch_form carries the diff
  const shell = withDraftStatus({
    status: "need_input",
    questions: [],
    suggestions: [],
    primary: { ...io.uiState.draft },
  });
  const next = patchDraft(shell, patch);
  const reason = Object.entries(patch)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  io.emit({
    type: "agent_message",
    runId: io.runId,
    agent: "composer",
    text: `Updated draft: ${reason}`,
  });
  io.emit({
    type: "policy_draft",
    runId: io.runId,
    draft: next,
  });

  return {
    text: `Updated the open draft (${reason}).`,
    action: {
      type: "patch_form",
      payload: { patch, reason },
    },
    policyDraft: next,
  };
}

async function runExecutePay(io: PipeIo): Promise<PipeOut> {
  edge(io.emit, io.runId, "composer", "solver", "gate");
  await ensureSolverGate({
    ctx: io.ctx,
    emit: io.emit,
    runId: io.runId,
    toolTrace: io.toolTrace,
  });
  io.agents.push({ agent: "solver", model: "code:evaluateSwapGate" });

  edge(
    io.emit,
    io.runId,
    "solver",
    "payer",
    io.ctx.gateProceed === false && !io.ctx.overrideExecute
      ? "gate blocked"
      : "x402 path",
  );
  const text = await runPayer({
    ctx: io.ctx,
    emit: io.emit,
    runId: io.runId,
    toolTrace: io.toolTrace,
    secrets: io.secrets,
  });
  io.agents.push({ agent: "payer", model: "code:postPaidTrigger" });

  const payOk =
    !text.startsWith("Skipped pay") &&
    !text.startsWith("Pay failed") &&
    !/busy|rate limit/i.test(text);
  if (payOk) {
    edge(io.emit, io.runId, "payer", "driver", "Base session fill");
    io.emit({
      type: "agent_start",
      runId: io.runId,
      agent: "driver",
      model: "code:executePolicy",
    });
    io.emit({
      type: "agent_message",
      runId: io.runId,
      agent: "driver",
      text: "Driver ready — Base fill only when a clear-signed band is hit.",
    });
    io.emit({ type: "agent_end", runId: io.runId, agent: "driver" });
    io.agents.push({ agent: "driver", model: "code:executePolicy" });
  }

  return { text: clipPart(text, 280), action: { type: "none" } };
}

/**
 * Pipeline dispatch — only `status` imports/calls runClerk.
 * Other handlers must not reference Clerk or Receipt Graph MCP tools.
 */
const DISPATCH: Record<Pipeline, (io: PipeIo) => Promise<PipeOut>> = {
  status: runStatus,
  advise: runAdvise,
  propose: runPropose,
  modify: runModify,
  execute: runExecutePay,
  full: runChitchat,
};

export async function orchestrate(opts: {
  secrets: KeeperSecrets;
  userMessages: { role: "user" | "assistant"; content: string }[];
  uiState?: UiState | null;
  emit?: Emit;
}): Promise<RunResult> {
  if (!opts.secrets.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY missing from Key Ring");
  }

  const runId = randomUUID().slice(0, 8);
  const toolTrace: string[] = [];
  const agents: { agent: AgentId; model: string }[] = [];
  const emit: Emit = (ev: AgentEvent) => {
    opts.emit?.(ev);
  };
  const uiState = opts.uiState ?? null;

  const userText = [...opts.userMessages]
    .reverse()
    .find((m) => m.role === "user")?.content;
  if (!userText?.trim()) throw new Error("user message required");

  emit({ type: "run_start", runId });

  const none = { type: "none" as const };

  // Absolute first: greetings never touch Graph / pay (Studio 429 storm)
  if (isGreeting(userText)) {
    let reply =
      "Hey — I can help draft a protection, check status, or talk through risk whenever you're ready.";
    try {
      const raw = await openRouterRound({
        apiKey: opts.secrets.openRouterApiKey,
        model: opts.secrets.openRouterModels.composer,
        messages: [
          {
            role: "system",
            content: `You are LGA's friendly protection assistant.
Reply in 1–2 warm sentences. Sound human.
Offer help with protections, status, or risk — do not call tools, do not mention rate limits, pipelines, or JSON.
Master key never leaves Ledger; Key Ring holds keeper secrets.`,
          },
          { role: "user", content: userText },
        ],
      });
      if (raw.content?.trim()) reply = raw.content.trim().slice(0, 320);
    } catch {
      /* fallback */
    }
    agents.push({
      agent: "composer",
      model: opts.secrets.openRouterModels.composer,
    });
    emit({
      type: "agent_start",
      runId,
      agent: "composer",
      model: opts.secrets.openRouterModels.composer,
    });
    emit({ type: "agent_message", runId, agent: "composer", text: reply });
    emit({ type: "agent_end", runId, agent: "composer" });
    emit({ type: "run_end", runId, reply, action: none });
    return {
      reply,
      toolTrace,
      runId,
      pipeline: "full",
      agents,
      gateProceed: null,
      policyDraft: null,
      action: none,
    };
  }

  const forcePropose = stickyPropose(opts.userMessages, uiState);
  const composed = await runComposer({
    secrets: opts.secrets,
    userText,
    userMessages: opts.userMessages,
    forcePropose,
    uiState,
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

  if (composed.note === "chitchat") {
    const out = await runChitchat({
      secrets: opts.secrets,
      userText,
      userMessages: opts.userMessages,
      brief: composed.note,
      overrideExecute: composed.overrideExecute,
      uiState,
      ctx,
      emit,
      runId,
      toolTrace,
      agents,
    });
    const reply = clipPart(out.text, 520);
    emit({ type: "run_end", runId, reply, action: out.action });
    return {
      reply,
      toolTrace,
      runId,
      pipeline: "full",
      agents,
      gateProceed: null,
      policyDraft: null,
      action: out.action,
    };
  }

  const pipe = composed.pipeline;
  const out = await DISPATCH[pipe]({
    secrets: opts.secrets,
    userText,
    userMessages: opts.userMessages,
    brief: composed.note,
    overrideExecute: composed.overrideExecute,
    uiState,
    ctx,
    emit,
    runId,
    toolTrace,
    agents,
  });

  const reply =
    clipPart(out.text, 520) ||
    "Try again with a shorter ask — status, advise, or draft a protection.";
  emit({ type: "run_end", runId, reply, action: out.action });

  return {
    reply,
    toolTrace,
    runId,
    pipeline: pipe,
    agents,
    gateProceed: ctx.gateProceed,
    policyDraft: out.policyDraft ?? null,
    action: out.action,
  };
}

function clipPart(raw: string, max = 280): string {
  const s = raw
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/hcs:\/\/\S+/gi, "")
    .replace(/\{[^{}]{30,}\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf(".\n"),
    cut.lastIndexOf("? "),
  );
  return `${(at > 60 ? cut.slice(0, at + 1) : cut).trim()}${at > 60 ? "" : "…"}`;
}
