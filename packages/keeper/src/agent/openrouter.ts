import type { AgentId, Emit, ToolDef } from "./types";
import type { KeeperSecrets } from "../ring";
import { runTool, type ToolCtx } from "./tools";

type Msg = Record<string, unknown>;

type ToolCall = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};

export async function openRouterRound(opts: {
  apiKey: string;
  model: string;
  messages: Msg[];
  tools?: ToolDef[];
  /** Force at least one tool call (OpenAI-compatible). */
  toolChoice?: "auto" | "required" | { type: "function"; function: { name: string } };
}): Promise<{
  content: string | null;
  tool_calls?: ToolCall[];
}> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? "auto";
  }

  // Sonnet + tool_choice=required can sit >90s on OpenRouter under load
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 180_000);
  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "content-type": "application/json",
        "HTTP-Referer": "https://github.com/ledgergaurd",
        "X-Title": "LGA Keeper Agent",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Error(
        `openrouter timeout ${timeoutMs}ms (${opts.model}) — try gpt-4o-mini for solver or raise OPENROUTER_TIMEOUT_MS`,
      );
    }
    throw e;
  }
  if (!res.ok) {
    throw new Error(
      `openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ToolCall[];
      };
    }[];
  };
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error("openrouter empty");
  return {
    content: msg.content ?? null,
    tool_calls: msg.tool_calls,
  };
}

/** Classify-only (no tools). */
export async function openRouterJson(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const r = await openRouterRound({
    apiKey: opts.apiKey,
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return r.content ?? "";
}

export async function runSpecialistLoop(opts: {
  secrets: KeeperSecrets;
  agent: AgentId;
  model: string;
  system: string;
  userContent: string;
  tools: ToolDef[];
  allow: Set<string>;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  maxRounds?: number;
  toolTrace: string[];
  /** First round must call a tool (stops "need more info" dead-ends). */
  forceToolsFirst?: boolean;
  /** If set with forceToolsFirst, require this specific tool on round 0. */
  forceToolName?: string;
}): Promise<string> {
  const {
    secrets,
    agent,
    model,
    system,
    userContent,
    tools,
    allow,
    ctx,
    emit,
    runId,
    toolTrace,
  } = opts;
  const maxRounds = opts.maxRounds ?? 5;

  emit({ type: "agent_start", runId, agent, model });
  const messages: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  let lastText = "";
  let usedTool = false;
  for (let i = 0; i < maxRounds; i++) {
    const forceFirst = opts.forceToolsFirst && i === 0 && !usedTool;
    const toolChoice = forceFirst
      ? opts.forceToolName
        ? ({
            type: "function" as const,
            function: { name: opts.forceToolName },
          } as const)
        : ("required" as const)
      : ("auto" as const);
    const msg = await openRouterRound({
      apiKey: secrets.openRouterApiKey,
      model,
      messages,
      tools,
      toolChoice,
    });

    if (msg.tool_calls?.length) {
      usedTool = true;
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });
      if (msg.content?.trim()) {
        emit({
          type: "agent_message",
          runId,
          agent,
          text: msg.content.trim().slice(0, 400),
        });
      }
      for (const tc of msg.tool_calls) {
        const name = tc.function.name;
        if (!allow.has(name)) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              error: `tool ${name} not allowed for ${agent}`,
            }),
          });
          continue;
        }
        toolTrace.push(`${agent}:${name}`);
        emit({ type: "tool_start", runId, agent, tool: name });
        const result = await runTool(ctx, name, tc.function.arguments || "{}");
        if (typeof result.gateProceed === "boolean") {
          ctx.gateProceed = result.gateProceed;
          let reasons: string[] = [];
          try {
            const parsed = JSON.parse(result.out) as { reasons?: string[] };
            if (Array.isArray(parsed.reasons)) reasons = parsed.reasons;
          } catch {
            /* ignore */
          }
          emit({
            type: "gate",
            runId,
            proceed: result.gateProceed,
            reasons,
          });
        }
        emit({
          type: "tool_end",
          runId,
          agent,
          tool: name,
          ok: result.ok,
          summary: result.summary,
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result.out,
        });
      }
      continue;
    }

    lastText = msg.content ?? "";
    if (lastText.trim()) {
      emit({
        type: "agent_message",
        runId,
        agent,
        text: lastText.trim().slice(0, 800),
      });
    }
    emit({ type: "agent_end", runId, agent });
    return lastText;
  }

  emit({ type: "agent_end", runId, agent });
  return lastText || `${agent} stopped after max rounds.`;
}
