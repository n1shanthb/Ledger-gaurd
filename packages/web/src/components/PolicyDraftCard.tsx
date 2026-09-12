"use client";

import { useEffect, useState } from "react";
import type {
  PolicyDraft,
  PolicyDraftItem,
  StrategyType,
} from "@/lib/agentEvents";
import { withDraftStatus } from "@/lib/agentEvents";

const STRATEGIES: StrategyType[] = [
  "STOP_LOSS",
  "TAKE_PROFIT",
  "BUY_DIP",
  "LP_RANGE",
];

const field =
  "mt-1 w-full rounded border border-mist bg-ink/40 px-2 py-1.5 text-sm text-paper outline-none focus:border-signal";
const labelCls = "text-xs text-mute";

function ItemFields({
  item,
  onChange,
  label,
}: {
  item: PolicyDraftItem;
  onChange: (next: PolicyDraftItem) => void;
  label: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-line bg-ink/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-mute">
        {label}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelCls}>
          Strategy
          <select
            className={field}
            value={item.strategyType}
            onChange={(e) =>
              onChange({
                ...item,
                strategyType: e.target.value as StrategyType,
              })
            }
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Asset
          <input
            className={field}
            value={item.asset}
            onChange={(e) => onChange({ ...item, asset: e.target.value })}
          />
        </label>
        <label className={labelCls}>
          Amount
          <input
            className={field}
            value={item.amount}
            placeholder="e.g. 0.5"
            onChange={(e) => onChange({ ...item, amount: e.target.value })}
          />
        </label>
        <label className={labelCls}>
          Slippage (bps)
          <input
            type="number"
            className={field}
            value={item.maxSlippageBps ?? 100}
            onChange={(e) =>
              onChange({
                ...item,
                maxSlippageBps: Number(e.target.value) || 100,
              })
            }
          />
        </label>
        <label className={labelCls}>
          Stop loss USD
          <input
            type="number"
            className={field}
            value={item.stopLossUsd ?? ""}
            onChange={(e) =>
              onChange({
                ...item,
                stopLossUsd: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </label>
        <label className={labelCls}>
          Take / buy trigger USD
          <input
            type="number"
            className={field}
            value={item.takeProfitUsd ?? ""}
            onChange={(e) =>
              onChange({
                ...item,
                takeProfitUsd: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </label>
      </div>
      <label className={`block ${labelCls}`}>
        Reasoning
        <textarea
          className={field}
          rows={2}
          value={item.reasoning}
          onChange={(e) => onChange({ ...item, reasoning: e.target.value })}
        />
      </label>
    </div>
  );
}

export function PolicyDraftCard({
  draft,
  busy,
  onChange,
  onConfirm,
}: {
  draft: PolicyDraft;
  busy: boolean;
  onChange: (d: PolicyDraft) => void;
  onConfirm: (d: PolicyDraft, includeAddons: boolean) => void;
}) {
  const [includeAddons, setIncludeAddons] = useState(false);
  const [local, setLocal] = useState(() => withDraftStatus(draft));

  useEffect(() => {
    setLocal(withDraftStatus(draft));
    setIncludeAddons(false);
  }, [draft]);

  const sync = (next: PolicyDraft) => {
    const stamped = withDraftStatus(next);
    setLocal(stamped);
    onChange(stamped);
  };

  const canConfirm = local.status === "ready";

  return (
    <div className="space-y-3 rounded-lg border border-signal/30 bg-signal/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-paper">Policy draft</h3>
        <span
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            local.status === "ready"
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-200"
          }`}
        >
          {local.status}
        </span>
      </div>

      {local.suggestions.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-xs text-mute">
          {local.suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}

      {local.questions.length > 0 && (
        <div className="space-y-1 text-xs text-mute">
          <p className="font-medium text-paper/80">Still need:</p>
          <ul className="list-disc pl-4">
            {local.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <p className="text-mute/70">
            Edit the form or answer in chat, then Confirm for Ledger.
          </p>
        </div>
      )}

      <ItemFields
        label="Primary"
        item={local.primary}
        onChange={(primary) => sync({ ...local, primary })}
      />

      {local.addons && local.addons.length > 0 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-mute">
            <input
              type="checkbox"
              checked={includeAddons}
              onChange={(e) => setIncludeAddons(e.target.checked)}
            />
            Include optional addon policies on confirm
          </label>
          {local.addons.map((addon, i) => (
            <ItemFields
              key={i}
              label={`Addon ${i + 1}`}
              item={addon}
              onChange={(item) => {
                const addons = [...(local.addons ?? [])];
                addons[i] = item;
                sync({ ...local, addons });
              }}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={busy || !canConfirm}
        onClick={() => onConfirm(local, includeAddons)}
        className="w-full rounded-full bg-signal px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40"
      >
        Confirm for Ledger clear-sign
      </button>
      <p className="text-[10px] text-mute">
        Does not broadcast. Master key never leaves Ledger; Key Ring holds
        keeper secrets.
      </p>
    </div>
  );
}
