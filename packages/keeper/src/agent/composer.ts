import type { KeeperSecrets } from "../ring";
import type { Emit, Pipeline, UiState } from "./types";
import { openRouterJson } from "./openrouter";

const PIPELINES = new Set<Pipeline>([
  "status",
  "advise",
  "propose",
  "modify",
  "execute",
  "full",
]);

export type ComposerResult = {
  pipeline: Pipeline;
  overrideExecute: boolean;
  note: string;
};

function parseComposer(raw: string): ComposerResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const slice =
    start >= 0 && end > start ? raw.slice(start, end + 1) : raw.trim();
  try {
    const j = JSON.parse(slice) as {
      pipeline?: string;
      overrideExecute?: boolean;
      note?: string;
    };
    let pipe = j.pipeline === "risk" ? "advise" : j.pipeline;
    const pipeline = PIPELINES.has(pipe as Pipeline)
      ? (pipe as Pipeline)
      : "full";
    return {
      pipeline,
      overrideExecute: Boolean(j.overrideExecute),
      note: typeof j.note === "string" ? j.note : "",
    };
  } catch {
    return { pipeline: "full", overrideExecute: false, note: "parse fallback" };
  }
}

/** Deterministic routes — don't let the LLM re-pay on "hi". */
export function isGreeting(userText: string): boolean {
  return /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|cool|gm|gn)[\s!.]*$/i.test(
    userText.trim(),
  );
}

export function isDecisionPhrase(userText: string): boolean {
  return /\b(should\s+i|shall\s+i|is\s+now\s+a\s+good\s+time|good\s+time\s+to|worth\s+(protect|buying|entering)|do\s+i\s+need\s+to\s+protect)\b/i.test(
    userText,
  );
}

export function quickRoute(
  userText: string,
  uiState?: UiState | null,
): ComposerResult | null {
  const t = userText.trim();
  if (!t) return null;

  if (isGreeting(t)) {
    return { pipeline: "full", overrideExecute: false, note: "chitchat" };
  }

  if (
    /\b(\/trigger|x402|paid\s+\/?trigger|run\s+a\s+paid|pay\s+(now|it)|execute\s+now|fill\s+now)\b/i.test(
      t,
    )
  ) {
    return { pipeline: "execute", overrideExecute: false, note: "explicit pay" };
  }

  // Form open: field edits → modify; new strategy → propose
  if (uiState?.formOpen) {
    if (
      /\b(instead|switch\s+to|change\s+(to|into)|different\s+strateg|new\s+(stop|policy|protection)|protect\s+(btc|eth|weth|cbbtc))\b/i.test(
        t,
      )
    ) {
      return {
        pipeline: "propose",
        overrideExecute: false,
        note: "new strategy while form open",
      };
    }
    if (
      /\b(make\s+it|set\s+(it|amount|stop|take|slip|bps)|change\s+(amount|stop|take|slip)|use\s+\d|^\d+(\.\d+)?\s*(eth|weth|usdc)?$|stop\s*(to|=|:)?\s*\$?\d)/i.test(
        t,
      )
    ) {
      return {
        pipeline: "modify",
        overrideExecute: false,
        note: "edit open draft",
      };
    }
  }

  if (
    /\b(explain|vs\.?|versus|compare|difference between|should\s+i|shall\s+i|is\s+now\s+a\s+good\s+time|am\s+i\s+exposed)\b/i.test(
      t,
    )
  ) {
    return {
      pipeline: "advise",
      overrideExecute: false,
      note: isDecisionPhrase(t) ? "advise decision" : "advise explain",
    };
  }

  if (
    /\b(protect|stop-?loss|take-?profit|buy[- ]?dip|clear-?sign|draft\s+(a\s+)?(policy|stop))\b/i.test(
      t,
    )
  ) {
    return { pipeline: "propose", overrideExecute: false, note: "policy intent" };
  }

  if (
    /\b(what('s| is)?\s+active|policies|receipts|status|payment\s+audit)\b/i.test(
      t,
    )
  ) {
    return { pipeline: "status", overrideExecute: false, note: "status" };
  }

  return null;
}

/** Prior intake left questions open — short replies like "2 eth" stay on propose/modify. */
export function stickyPropose(
  messages: { role: "user" | "assistant"; content: string }[],
  uiState?: UiState | null,
): boolean {
  if (uiState?.formOpen) {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return false;
    // Short amount / band replies while form is open → modify, not sticky propose
    if (
      /^\s*\d+(\.\d+)?\s*(eth|weth|usdc)?\s*$/i.test(last.content) ||
      /\b(make\s+it|set\s+|stop\s+|amount)\b/i.test(last.content)
    ) {
      return false;
    }
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return false;

  const lastAsst = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  if (!lastAsst) return false;

  const open =
    /Policy intake/i.test(lastAsst.content) ||
    /Draft need_input/i.test(lastAsst.content) ||
    /\n\? /m.test(lastAsst.content);
  if (!open) return false;

  if (
    /\b(risk|messari|borrow|depth|trigger|pay|x402|receipt|status|policies|gate)\b/i.test(
      last.content,
    ) &&
    !/\b(stop|protect|amount|slip|bps|eth|weth|dip|\$|\d)/i.test(last.content)
  ) {
    return false;
  }

  return true;
}

export async function runComposer(opts: {
  secrets: KeeperSecrets;
  userText: string;
  userMessages?: { role: "user" | "assistant"; content: string }[];
  forcePropose?: boolean;
  uiState?: UiState | null;
  emit: Emit;
  runId: string;
}): Promise<ComposerResult> {
  const model = opts.secrets.openRouterModels.composer;
  opts.emit({
    type: "agent_start",
    runId: opts.runId,
    agent: "composer",
    model,
  });

  const finish = (result: ComposerResult) => {
    const friendly =
      result.note === "chitchat"
        ? "Saying hi"
        : result.note === "explicit pay"
          ? "Checking a paid trigger for you"
          : result.note.startsWith("advise")
            ? "Looking at the risk angle"
            : result.note === "policy intent" ||
                result.note.includes("new strategy")
              ? "Helping draft a protection"
              : result.note === "edit open draft" || result.pipeline === "modify"
                ? "Updating the open draft"
                : result.note === "status"
                  ? "Checking Receipt Graph"
                  : result.pipeline === "execute"
                    ? "Running a paid check"
                    : "On it";
    opts.emit({
      type: "agent_message",
      runId: opts.runId,
      agent: "composer",
      text: friendly,
    });
    opts.emit({ type: "agent_end", runId: opts.runId, agent: "composer" });
    return result;
  };

  if (opts.forcePropose) {
    return finish({
      pipeline: "propose",
      overrideExecute: false,
      note: "sticky intake follow-up",
    });
  }

  // Form open + short edit → modify before other quick routes
  if (opts.uiState?.formOpen) {
    const edit = quickRoute(opts.userText, opts.uiState);
    if (edit?.pipeline === "modify" || edit?.pipeline === "propose") {
      return finish(edit);
    }
  }

  const quick = quickRoute(opts.userText, opts.uiState);
  if (quick) return finish(quick);

  const history =
    opts.userMessages && opts.userMessages.length > 1
      ? opts.userMessages
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")
          .slice(-4000)
      : opts.userText;

  const uiLine = opts.uiState
    ? `UI form: open=${opts.uiState.formOpen} kind=${opts.uiState.formKind ?? "none"} draft=${
        opts.uiState.draft
          ? JSON.stringify({
              strategyType: opts.uiState.draft.strategyType,
              asset: opts.uiState.draft.asset,
              amount: opts.uiState.draft.amount,
              stopLossUsd: opts.uiState.draft.stopLossUsd,
              takeProfitUsd: opts.uiState.draft.takeProfitUsd,
            })
          : "null"
      }`
    : "UI form: open=false";

  const system = `You are LGA Composer. Classify the LATEST user message into ONE pipeline.
Reply with ONLY JSON: {"pipeline":"status"|"advise"|"propose"|"modify"|"execute"|"full","overrideExecute":boolean,"note":"short"}
Rules:
- status: policies / receipts / what's active (ONLY path that may touch Receipt Graph)
- advise: explain/compare OR "should I protect" style decision questions — NEVER pay
- propose: draft a NEW protection for Ledger clear-sign
- modify: edit fields on the currently OPEN form (amount, stop, asset tweaks) — only when form is open
- execute: ONLY if latest message explicitly asks to pay / trigger / run paid eval NOW
- full: chitchat or vague — NEVER pay
- If form is open and user edits values → modify. If form is open but user wants a different strategy → propose.
- If no form and user asks whether to protect / buy the dip → advise.
- Do NOT keep execute sticky from earlier turns. "hi" / "ok" / thanks → full.
- overrideExecute=true ONLY if user says override / force / ignore gate
Master key never leaves Ledger; Key Ring holds keeper secrets.`;

  const raw = await openRouterJson({
    apiKey: opts.secrets.openRouterApiKey,
    model,
    system,
    user: `${uiLine}\n\n${history}`,
  });
  const result = parseComposer(raw);
  // Safety: never execute unless latest user text has pay intent
  if (
    result.pipeline === "execute" &&
    !/\b(\/trigger|x402|paid|pay\b|execute|fill now|run a paid)\b/i.test(
      opts.userText,
    )
  ) {
    result.pipeline = "full";
    result.note = `${result.note} (blocked sticky execute)`.trim();
  }
  // Safety: modify only when form is open
  if (result.pipeline === "modify" && !opts.uiState?.formOpen) {
    result.pipeline = "propose";
    result.note = `${result.note} (no form → propose)`.trim();
  }
  return finish(result);
}
