"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useAgentRun } from "@/hooks/useAgentRun";
import type { PolicyDraft } from "@/lib/agentEvents";
import { stripAgentJargon } from "@/lib/chatCopy";

const PROMPTS = [
  "Draft a conservative ETH stop-loss I can clear-sign.",
  "Buy-dip with USDC when ETH dips — leave amount blank if unsure.",
  "Take-profit on ETH — explain the band briefly.",
];

export function JourneyStrategyAgents({
  onApplyDraft,
}: {
  onApplyDraft: (draft: PolicyDraft) => void;
}) {
  const {
    messages,
    busy,
    err,
    run,
    formDraft,
    suggestion,
    acceptSuggestion,
    evidence,
    graph,
  } = useAgentRun();
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy, graph.reply]);

  const ask = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text || busy) return;
    setInput("");
    await run(text);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask();
    }
  };

  const draft = formDraft ?? suggestion?.draft ?? null;

  return (
    <div className="border-t border-line pt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        Customize with agents
      </p>
      <p className="mt-2 max-w-xl text-sm text-mute">
        Composer drafts a protection; Clerk/Solver advise. Apply the draft into
        this journey — you still clear-sign on Ledger.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <li key={p}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void ask(p)}
              className="border border-line px-2.5 py-1.5 text-left text-xs text-mute hover:border-mist hover:text-paper disabled:opacity-40"
            >
              {p}
            </button>
          </li>
        ))}
      </ul>

      <div
        ref={threadRef}
        className="mt-4 max-h-52 space-y-2 overflow-y-auto border border-line bg-ink/40 px-3 py-3"
        aria-live="polite"
      >
        {messages.length === 0 && !busy && (
          <p className="text-xs text-mute">Ask for a draft or risk check…</p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`text-sm ${m.role === "user" ? "text-paper" : "text-mute"}`}
          >
            <span className="font-mono text-[9px] uppercase tracking-wider text-mute">
              {m.role === "user" ? "You" : "Agents"}
            </span>
            <p className="mt-0.5 whitespace-pre-wrap">
              {m.role === "assistant" ? stripAgentJargon(m.content) : m.content}
            </p>
          </div>
        ))}
        {busy && (
          <p className="font-mono text-[10px] text-warn">Agents working…</p>
        )}
      </div>

      {err && (
        <p className="mt-2 text-xs text-kill">{err}</p>
      )}

      {(evidence?.length || suggestion) && !formDraft && (
        <div className="mt-3 border border-line px-3 py-2.5">
          <p className="text-xs text-mute">
            {suggestion?.cta ?? "Suggestion ready"}
          </p>
          {suggestion && (
            <Button
              className="mt-2"
              type="button"
              disabled={busy}
              onClick={acceptSuggestion}
            >
              Open draft
            </Button>
          )}
        </div>
      )}

      {draft && (
        <div className="mt-3 border border-signal/40 bg-signal/10 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-signal">
            Draft ready
          </p>
          <p className="mt-1 text-sm text-paper">
            {draft.primary.strategyType.replace(/_/g, " ")} ·{" "}
            {draft.primary.asset}
            {draft.primary.amount ? ` · amt ${draft.primary.amount}` : ""}
            {draft.primary.stopLossUsd != null
              ? ` · stop $${draft.primary.stopLossUsd}`
              : ""}
            {draft.primary.takeProfitUsd != null
              ? ` · take $${draft.primary.takeProfitUsd}`
              : ""}
          </p>
          <Button
            className="mt-3"
            type="button"
            disabled={busy}
            onClick={() => onApplyDraft(draft)}
          >
            Use in journey → limits
          </Button>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <textarea
          className="max-h-20 min-h-[2.5rem] flex-1 resize-none border border-mist bg-ink/40 px-3 py-2 text-sm text-paper outline-none focus:border-signal"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={busy}
          placeholder="Message agents…"
          aria-label="Message agents"
        />
        <Button
          className="!rounded-none !px-3"
          disabled={busy || !input.trim()}
          onClick={() => void ask()}
        >
          {busy ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
