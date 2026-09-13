"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PolicyDraftCard } from "@/components/PolicyDraftCard";
import { AgentCompanionRail } from "@/components/protect/AgentCompanionRail";
import { useProtectionOptional } from "@/components/ProtectionProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { useAgentRun } from "@/hooks/useAgentRun";
import { formatAssistantBubble, type ChatBlock } from "@/lib/chatCopy";

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

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function AddressBox({ address, label }: { address: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 border border-line bg-ink/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
          {label ?? "Address"}
        </p>
        <button
          type="button"
          className="font-mono text-[9px] uppercase tracking-wider text-mute hover:text-signal"
          onClick={() => {
            void navigator.clipboard.writeText(address).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-paper" title={address}>
        <span className="text-signal">{shortAddr(address)}</span>
        <span className="ml-2 text-mute">{address}</span>
      </p>
      <a
        href={`https://basescan.org/address/${address}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 inline-block font-mono text-[10px] text-signal hover:underline"
      >
        Basescan →
      </a>
    </div>
  );
}

function JsonBox({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const err =
    typeof value.error === "string"
      ? value.error
      : typeof value.message === "string"
        ? value.message
        : null;
  const busy = err && /429|rate limit|busy|Receipt Graph/i.test(err);
  if (busy) {
    return (
      <div className="mt-2 border border-warn/40 bg-warn/5 px-3 py-2.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-warn">
          Receipt Graph
        </p>
        <p className="mt-1 text-sm text-paper">
          Receipt Graph query limited (HTTP 429). If this persists, confirm
          Gateway URL (not Studio) and restart web/keeper. Not a Ledger or
          wallet error — no fill claimed.
        </p>
      </div>
    );
  }
  const entries = Object.entries(value).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  return (
    <div className="mt-2 border border-line bg-ink/60 px-3 py-2.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
          {`{ } ${label}`}
        </p>
        <span className="font-mono text-[9px] uppercase text-mute">
          {open ? "hide" : "open"}
        </span>
      </button>
      {open && (
        <dl className="mt-2 space-y-1.5 border-t border-line/80 pt-2">
          {entries.map(([k, v]) => {
            const s =
              typeof v === "string"
                ? v
                : typeof v === "number" || typeof v === "boolean"
                  ? String(v)
                  : JSON.stringify(v);
            const isAddr = /^0x[a-fA-F0-9]{40}$/.test(s);
            return (
              <div
                key={k}
                className="grid grid-cols-[5.5rem_1fr] gap-2 font-mono text-[11px]"
              >
                <dt className="text-mute">{k}</dt>
                <dd className="break-all text-paper">
                  {isAddr ? shortAddr(s) : s.length > 80 ? `${s.slice(0, 80)}…` : s}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

function RichBlocks({ blocks }: { blocks: ChatBlock[] }) {
  return (
    <div className="space-y-1">
      {blocks.map((b, i) => {
        if (b.kind === "text") {
          return (
            <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
              {b.text}
            </p>
          );
        }
        if (b.kind === "address") {
          return (
            <AddressBox key={i} address={b.address} label={b.label} />
          );
        }
        return <JsonBox key={i} label={b.label} value={b.value} />;
      })}
    </div>
  );
}

function ChatBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const [open, setOpen] = useState(false);
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-paper px-3.5 py-2.5 text-sm leading-relaxed text-ink">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }
  const { preview, detail, blocks } = formatAssistantBubble(content);
  const hasBoxes = blocks.some((b) => b.kind !== "text");
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] border border-line bg-panel2 px-3.5 py-2.5 text-paper">
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-signal">
          Agent
        </p>
        {hasBoxes ? (
          <RichBlocks
            blocks={
              open || !detail
                ? blocks
                : [
                    { kind: "text", text: preview },
                    ...blocks.filter((b) => b.kind !== "text"),
                  ]
            }
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {open && detail ? detail : preview}
          </p>
        )}
        {detail && (
          <button
            type="button"
            className="mt-2 font-mono text-[10px] uppercase tracking-wider text-mute hover:text-signal"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

export function KeeperAgentPanel() {
  const {
    graph,
    formDraft,
    suggestion,
    evidence,
    signedTx,
    busy,
    err,
    run,
    reset,
    confirmDraft,
    setPolicyDraft,
    acceptSuggestion,
    dismissSuggestion,
    messages,
    keeperBase,
  } = useAgentRun();
  const protection = useProtectionOptional();
  const stage = protection?.stage ?? "device";
  const [input, setInput] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [health, setHealth] = useState<string>("…");
  const [show3d, setShow3d] = useState(false);
  const [preferStatic, setPreferStatic] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mobile =
      typeof window !== "undefined" &&
      (window.matchMedia("(max-width: 768px)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setPreferStatic(mobile);
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy, graph.reply]);

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

  const chatStarted = messages.length > 0 || Boolean(formDraft);

  const ask = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text) return;
    setInput("");
    await run(text);
    void refreshPayments();
  };

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && input.trim()) void ask();
    }
  };

  const SUGGESTIONS = [
    "Draft a conservative ETH stop-loss I can clear-sign.",
    "Explain buy-dip vs stop-loss for USDC on hand.",
    "Run a paid /trigger evaluation — report payment vs fill honestly.",
  ];

  const chatBox = (
    <div className="flex h-[min(32rem,70vh)] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Chat
          </p>
          <p className="mt-1 text-xs text-mute">
            Ask anything — payments still aren’t fills.
          </p>
          {!protection?.ledgerAddress && (
            <p className="mt-2 text-xs text-warn/90">
              Wallet UI lives on{" "}
              <a href="/protect" className="text-signal underline">
                Protect
              </a>{" "}
              (Connect Ledger → Open wallet). Agent only shows balances after
              that.
            </p>
          )}
        </div>
        {chatStarted && (
          <Button variant="ghost" disabled={busy} onClick={() => reset()}>
            New chat
          </Button>
        )}
      </div>

      <div
        ref={threadRef}
        className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1"
        aria-live="polite"
      >
        {!chatStarted && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-mute">
              Ask for a protection draft, status, or risk check.
            </p>
            <ul className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void ask(s)}
                    className="w-full border border-line px-3 py-2.5 text-left text-sm text-mute transition hover:border-mist hover:text-paper"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble
            key={`${m.role}-${i}-${m.content.slice(0, 24)}`}
            role={m.role}
            content={m.content}
          />
        ))}

        {busy && (
          <div className="flex justify-start">
            <p className="border border-line bg-panel2 px-3.5 py-2.5 font-mono text-xs text-mute">
              Thinking…
            </p>
          </div>
        )}

        {err && (
          <p className="border-l-2 border-kill/50 pl-3 text-sm text-kill">{err}</p>
        )}
      </div>

      <div className="mt-3 shrink-0 border-t border-line pt-3">
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-24 min-h-[2.75rem] flex-1 resize-none border border-mist bg-ink/40 px-3 py-2.5 text-sm text-paper outline-none focus:border-signal"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onComposerKey}
            disabled={busy}
            placeholder="Message agents…"
            aria-label="Message agents"
          />
          <Button
            className="!rounded-none !px-4"
            disabled={busy || !input.trim()}
            onClick={() => void ask()}
          >
            {busy ? "…" : "Send"}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void ask("What policies are active for me on Receipt Graph?")
            }
            className="font-mono text-[10px] uppercase tracking-wider text-mute hover:text-signal disabled:opacity-40"
          >
            Clerk status
          </button>
          <details className="ml-auto">
            <summary className="cursor-pointer font-mono text-[10px] uppercase text-mute">
              Event log
            </summary>
            <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto font-mono text-[11px] text-mute">
              {graph.log.length === 0 && <li>Idle.</li>}
              {graph.log.map((l) => (
                <li key={`${l.t}-${l.line}`}>
                  {new Date(l.t).toLocaleTimeString()} {l.line}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <AgentCompanionRail
        stage={stage}
        graph={graph}
        compact={chatStarted}
        onAsk={
          chatStarted
            ? undefined
            : (p) => {
                setInput(p);
                void ask(p);
              }
        }
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

      {(evidence?.length || suggestion) && !formDraft && (
        <Panel className="!pt-4 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">
            Market read
          </p>
          {(evidence ?? suggestion?.evidence ?? []).length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-paper">
              {(evidence ?? suggestion?.evidence ?? []).map((e) => (
                <li key={`${e.source}-${e.label}`} className="flex gap-2">
                  <span className="font-mono text-[10px] uppercase text-mute shrink-0">
                    {e.source}
                  </span>
                  <span>
                    <span className="text-mute">{e.label}: </span>
                    {e.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {suggestion ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={acceptSuggestion} disabled={busy}>
                {suggestion.cta}
              </Button>
              <button
                type="button"
                onClick={dismissSuggestion}
                className="font-mono text-[11px] text-mute hover:text-paper"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={dismissSuggestion}
              className="mt-3 font-mono text-[11px] text-mute hover:text-paper"
            >
              Dismiss
            </button>
          )}
        </Panel>
      )}

      {formDraft ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel className="!pt-4">
            {signedTx && (
              <div className="mb-4 border border-signal/40 bg-signal/10 px-3 py-2.5 text-sm text-paper">
                <p className="font-mono text-[10px] uppercase tracking-wider text-signal">
                  Clear-signed on Ledger
                </p>
                <p className="mt-1 text-mute">
                  Policy is on Base. Chat and draft stay here on purpose.
                </p>
                <a
                  href={`https://basescan.org/tx/${signedTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-mono text-[11px] text-signal hover:underline"
                >
                  {signedTx.slice(0, 10)}…{signedTx.slice(-8)} →
                </a>
              </div>
            )}
            <PolicyDraftCard
              draft={formDraft}
              busy={busy}
              ledgerAddress={protection?.ledgerAddress}
              onChange={(d) => setPolicyDraft(d)}
              onConfirm={(d, includeAddons) => {
                void confirmDraft(d, includeAddons, {
                  accountIndex: protection?.accountIndex ?? 1,
                }).then((r) => {
                  if (r && "ok" in r && r.ok && protection) {
                    // Record proof — do NOT jump journey stage (that felt like a wipe)
                    protection.setLastPolicyTx(r.txHash);
                    protection.setLedgerAddress(r.from);
                    protection.setConnected(true);
                  }
                });
              }}
            />
          </Panel>
          <Panel className="!pt-4">{chatBox}</Panel>
        </div>
      ) : (
        <Panel className="!pt-4 max-w-3xl">{chatBox}</Panel>
      )}

      <details className="border-t border-line pt-4">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-mute">
          Paid attempts · {payments.length} · not fills unless executed
        </summary>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => void refreshPayments()}
            className="font-mono text-[11px] text-signal"
          >
            Refresh
          </button>
        </div>
        {payments.length === 0 && (
          <p className="mt-2 text-sm text-mute">
            No attempts yet. Run paid attempt from Protect monitoring or ask to
            execute.
          </p>
        )}
        <ul className="mt-3 max-h-48 space-y-3 overflow-y-auto">
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
      </details>
    </div>
  );
}
