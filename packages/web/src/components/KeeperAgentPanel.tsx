"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentOpsGraph } from "@/components/AgentOpsGraph";
import { useAgentRun } from "@/hooks/useAgentRun";

type Payment = {
  attemptId: string;
  paidAt: number;
  path: string;
  evaluated: number;
  executed: { policyId: string; trigger: string; tx?: string }[];
  hashscanUrl?: string | null;
  hcsRef?: string | null;
  hcsTopicUrl?: string | null;
  note?: string;
};

export function KeeperAgentPanel() {
  const { graph, busy, err, run, reset, keeperBase } = useAgentRun();
  const [input, setInput] = useState(
    "Should I execute? Check policies and swap gate first.",
  );
  const [payments, setPayments] = useState<Payment[]>([]);
  const [health, setHealth] = useState<string>("…");

  const refreshPayments = useCallback(async () => {
    try {
      const res = await fetch(`${keeperBase}/payments/recent?limit=10`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`payments ${res.status}`);
      const j = (await res.json()) as { payments: Payment[] };
      setPayments(j.payments ?? []);
    } catch {
      /* health line covers unreachable */
    }
  }, [keeperBase]);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch(`${keeperBase}/health`, { cache: "no-store" });
      const j = (await res.json()) as {
        poll?: { mode?: string; ms?: number };
        openRouter?: boolean;
        openRouterModels?: Record<string, string>;
      };
      const models = j.openRouterModels
        ? ` · ${Object.values(j.openRouterModels)
            .map((m) => m.split("/").pop())
            .join("/")}`
        : "";
      setHealth(
        `${j.poll?.mode ?? "?"} · openRouter=${j.openRouter ? "yes" : "no"}${models}`,
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

  const ask = async () => {
    await run(input);
    void refreshPayments();
  };

  return (
    <div className="space-y-5">
      <AgentOpsGraph graph={graph} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="font-mono text-[11px] text-mute">{health}</p>
          <p className="mt-2 text-sm text-mute">
            Coordinator → Sentinel / Oracle / Broker. One OpenRouter key, per-agent
            models. Viz animates only from SSE events — not mock loops. Master key
            never leaves Ledger; Key Ring holds keeper secrets.
          </p>
          <textarea
            className="mt-3 w-full rounded-lg border border-mist bg-ink/40 px-3 py-2 text-sm text-paper outline-none focus:border-signal"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void ask()}
              className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
            >
              {busy ? "Running pipeline…" : "Run agents"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => reset()}
              className="rounded-full border border-mist px-4 py-2 text-sm text-mute hover:text-paper"
            >
              Reset graph
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-kill">{err}</p>}
          {graph.reply && (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-ink/50 p-3 text-sm text-paper">
              {graph.reply}
            </pre>
          )}
        </div>

        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">
            Event log
          </p>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto font-mono text-[11px] text-mute xl:max-h-[22rem]">
            {graph.log.length === 0 && (
              <li>Idle — ask something to start the pipeline.</li>
            )}
            {graph.log.map((l) => (
              <li key={`${l.t}-${l.line}`}>
                <span className="text-paper/50">
                  {new Date(l.t).toLocaleTimeString()}
                </span>{" "}
                {l.line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase tracking-wider text-mute">
            x402 payments · HashScan
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
            No attempts yet. Broker tool or npm run pay.
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {payments.map((p) => (
            <li
              key={p.attemptId}
              className="border-t border-line/80 pt-3 font-mono text-xs text-mute"
            >
              <div className="text-paper">
                {p.attemptId} · {p.path} · eval {p.evaluated} · fills{" "}
                {p.executed.length}
              </div>
              <div>{new Date(p.paidAt).toLocaleString()}</div>
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
              {p.hcsRef && <div className="text-mute">HCS {p.hcsRef}</div>}
              {p.executed.map((e) =>
                e.tx ? (
                  <div key={e.tx}>
                    <a
                      href={`https://basescan.org/tx/${e.tx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-signal hover:underline"
                    >
                      Base {e.trigger} {e.tx.slice(0, 10)}…
                    </a>
                  </div>
                ) : null,
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
