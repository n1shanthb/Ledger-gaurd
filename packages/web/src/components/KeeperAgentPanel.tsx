"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { PolicyDraftCard } from "@/components/PolicyDraftCard";
import { AgentCompanionRail } from "@/components/protect/AgentCompanionRail";
import { useProtectionOptional } from "@/components/ProtectionProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { useAgentRun } from "@/hooks/useAgentRun";

const AgentOpsGraph = dynamic(
  () =>
    import("@/components/AgentOpsGraph").then((m) => m.AgentOpsGraph),
  {
    ssr: false,
    loading: () => (
      <p className="font-mono text-xs text-mute">Loading live ops…</p>
    ),
  },
);

type Payment = {
  attemptId: string;
  paidAt: number;
  path: string;
  evaluated: number;
  executed: { policyId: string; trigger: string; tx?: string }[];
  hashscanUrl?: string | null;
  hcsRef?: string | null;
  hcsTopicUrl?: string | null;
  agentId?: string | null;
  note?: string;
};

export function KeeperAgentPanel() {
  const {
    graph,
    busy,
    err,
    run,
    reset,
    confirmDraft,
    setPolicyDraft,
    keeperBase,
  } = useAgentRun();
  const protection = useProtectionOptional();
  const stage = protection?.stage ?? "device";
  const [input, setInput] = useState(
    "Protect my ETH if it dumps tonight — draft a stop-loss I can clear-sign.",
  );
  const [payments, setPayments] = useState<Payment[]>([]);
  const [health, setHealth] = useState<string>("…");
  const [show3d, setShow3d] = useState(false);
  const [preferStatic, setPreferStatic] = useState(false);

  useEffect(() => {
    const mobile =
      typeof window !== "undefined" &&
      (window.matchMedia("(max-width: 768px)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setPreferStatic(mobile);
  }, []);

  const refreshPayments = useCallback(async () => {
    try {
      const res = await fetch(`${keeperBase}/payments/recent?limit=10`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`payments ${res.status}`);
      const j = (await res.json()) as { payments: Payment[] };
      setPayments(j.payments ?? []);
    } catch {
      /* health covers unreachable */
    }
  }, [keeperBase]);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch(`${keeperBase}/health`, { cache: "no-store" });
      const j = (await res.json()) as {
        poll?: { mode?: string };
        openRouter?: boolean;
      };
      setHealth(
        `${j.poll?.mode ?? "?"} · openRouter=${j.openRouter ? "yes" : "no"}`,
      );
    } catch {
      setHealth(`unreachable · ${keeperBase}`);
    }
  }, [keeperBase]);

  useEffect(() => {
    void refreshHealth();
    void refreshPayments();
    const id = setInterval(() => {
      void refreshPayments();
      void refreshHealth();
    }, 20_000);
    return () => clearInterval(id);
  }, [refreshHealth, refreshPayments]);

  const ask = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text) return;
    await run(text);
    void refreshPayments();
  };

  return (
    <div className="space-y-5">
      <AgentCompanionRail
        stage={stage}
        graph={graph}
        onAsk={(p) => {
          setInput(p);
          void ask(p);
        }}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
          Agent room · {health}
        </p>
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute hover:text-signal"
          onClick={() => setShow3d((v) => !v)}
        >
          {show3d ? "Hide live ops" : "Live operations"}
        </button>
      </div>

      {show3d && !preferStatic && <AgentOpsGraph graph={graph} />}
      {show3d && preferStatic && (
        <Panel>
          <p className="font-mono text-[10px] uppercase text-mute">
            Live operations · 2D fallback
          </p>
          <p className="mt-2 text-sm text-mute">
            Reduced motion / mobile: companion rail above reflects SSE state. Open
            desktop without reduced motion for the immersive graph.
          </p>
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-mute">
            {graph.log.slice(-8).map((l) => (
              <li key={`${l.t}-${l.line}`}>{l.line}</li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Panel>
          <p className="text-sm text-mute">
            Ask in plain language. Composer drafts; Clerk reads Receipt Graph; Solver
            explains trade-offs. Payer / Autopilot / Driver are workers — a payment is
            not a fill.
          </p>
          <textarea
            className="mt-3 w-full border border-mist bg-ink/40 px-3 py-2 text-sm text-paper outline-none focus:border-signal"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            aria-label="Ask agents"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={busy || !input.trim()}
              onClick={() => void ask()}
            >
              {busy ? "Running…" : "Ask agents"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => reset()}>
              Reset
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void ask(
                  "What policies are active for me on Receipt Graph?",
                )
              }
            >
              Ask Clerk status
            </Button>
          </div>
          {err && <p className="mt-3 text-sm text-kill">{err}</p>}
          {graph.policyDraft && (
            <div className="mt-4">
              <PolicyDraftCard
                draft={graph.policyDraft}
                busy={busy}
                onChange={(d) => setPolicyDraft(d)}
                onConfirm={(d, includeAddons) => {
                  void confirmDraft(d, includeAddons);
                }}
              />
            </div>
          )}
          {graph.reply && (
            <div className="mt-4 border border-line bg-panel/40 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal">
                Reply
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper">
                {graph.reply}
              </p>
            </div>
          )}
        </Panel>

        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">
            Suggestions
          </p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {[
              "Draft a conservative ETH stop-loss I can clear-sign.",
              "Explain buy-dip vs stop-loss for USDC on hand.",
              "Run a paid /trigger evaluation — report payment vs fill honestly.",
            ].map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full border-0 px-0 py-3 text-left text-sm text-mute hover:text-paper"
                  onClick={() => {
                    setInput(s);
                    void ask(s);
                  }}
                  disabled={busy}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-[10px] uppercase text-mute">
              Technical event log
            </summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-[11px] text-mute">
              {graph.log.length === 0 && <li>Idle.</li>}
              {graph.log.map((l) => (
                <li key={`${l.t}-${l.line}`}>
                  {new Date(l.t).toLocaleTimeString()} {l.line}
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase tracking-wider text-mute">
            Paid attempts · not fills unless executed
          </p>
          <button
            type="button"
            onClick={() => void refreshPayments()}
              className="font-mono text-[11px] text-signal"
          >
            Refresh
          </button>
        </div>
        {payments.length === 0 && (
          <p className="mt-3 text-sm text-mute">
            No attempts yet. Run paid attempt from Protect monitoring or ask Payer here.
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {payments.map((p) => (
            <li
              key={p.attemptId}
              className="border-t border-line/80 pt-3 text-xs text-mute"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={p.executed.length ? "success" : "warn"}>
                  {p.executed.length ? "eval + fill" : "payment / eval"}
                </Badge>
                <span className="font-mono text-paper">
                  eval {p.evaluated} · fills {p.executed.length}
                </span>
              </div>
              <div className="mt-1 font-mono">
                {new Date(p.paidAt).toLocaleString()}
              </div>
              {p.hashscanUrl && (
                <a
                  href={p.hashscanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-signal hover:underline"
                >
                  HashScan →
                </a>
              )}
              {p.executed.map((e) =>
                e.tx ? (
                  <div key={e.tx}>
                    <a
                      href={`https://basescan.org/tx/${e.tx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-signal hover:underline"
                    >
                      Base fill {e.trigger} {e.tx.slice(0, 10)}…
                    </a>
                  </div>
                ) : null,
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
