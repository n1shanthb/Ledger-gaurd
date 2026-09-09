"use client";

import { useCallback, useEffect, useState } from "react";

const keeperBase =
  process.env.NEXT_PUBLIC_KEEPER_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3001";

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
  const [input, setInput] = useState(
    "List active policies and ETH Pyth spot. Propose a tight buy-dip if useful.",
  );
  const [reply, setReply] = useState<string>("");
  const [trace, setTrace] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch(`${keeperBase}/health`, { cache: "no-store" });
      const j = (await res.json()) as {
        poll?: { mode?: string; ms?: number };
        openRouter?: boolean;
      };
      setHealth(
        `${j.poll?.mode ?? "?"} · openRouter=${j.openRouter ? "yes" : "no"} · ${keeperBase}`,
      );
    } catch {
      setHealth(`unreachable · ${keeperBase}`);
    }
  }, []);

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
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${keeperBase}/agent/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
        }),
      });
      const j = (await res.json()) as {
        reply?: string;
        toolTrace?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? `agent ${res.status}`);
      setReply(j.reply ?? "");
      setTrace(j.toolTrace ?? []);
      void refreshPayments();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[11px] text-mute">{health}</p>
        <p className="mt-2 text-sm text-mute">
          Agent proposes; Ledger clear-signs policies.{" "}
          <code className="text-paper">requestExecutionAttempt</code> pays Hedera
          x402 then hits <code className="text-paper">/trigger</code>. Prefer{" "}
          <code className="text-paper">evaluateSwapGate</code> before sizeable
          trades.
        </p>
        <textarea
          className="mt-3 w-full rounded-lg border border-mist bg-ink/40 px-3 py-2 text-sm text-paper outline-none focus:border-signal"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void ask()}
          className="mt-2 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {busy ? "Thinking…" : "Ask agent"}
        </button>
        {err && <p className="mt-2 text-sm text-kill">{err}</p>}
        {trace.length > 0 && (
          <p className="mt-2 font-mono text-[11px] text-mute">
            tools: {trace.join(" → ")}
          </p>
        )}
        {reply && (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-ink/50 p-3 text-sm text-paper">
            {reply}
          </pre>
        )}
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
            No attempts yet. Use pay-on-hit, npm run pay, or agent tool.
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
