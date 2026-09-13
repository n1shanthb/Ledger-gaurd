"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PolicyDraft,
  PolicyDraftItem,
  StrategyType,
} from "@/lib/agentEvents";
import { withDraftStatus } from "@/lib/agentEvents";
import { fetchHoldings, type AssetHolding } from "@/lib/holdings";
import type { Address } from "viem";

const STRATEGIES: StrategyType[] = [
  "STOP_LOSS",
  "TAKE_PROFIT",
  "BUY_DIP",
  "LP_RANGE",
];

const field =
  "mt-1 w-full border border-mist bg-ink/40 px-2 py-1.5 text-sm text-paper outline-none focus:border-signal";
const labelCls = "text-xs text-mute";

type FocusBind = (field: string) => {
  onFocus: () => void;
  onBlur: () => void;
};

function spendUnit(item: PolicyDraftItem): {
  symbol: string;
  holdingIds: string[];
  leaveGas?: boolean;
} {
  if (item.strategyType === "BUY_DIP") {
    return { symbol: "USDC", holdingIds: ["usdc"] };
  }
  const a = item.asset.trim().toLowerCase();
  if (a.includes("btc") || a === "cbbtc") {
    return { symbol: "cbBTC", holdingIds: ["cbbtc"] };
  }
  if (a.includes("usdc") || a.includes("usdt")) {
    return { symbol: "USDC", holdingIds: ["usdc"] };
  }
  return { symbol: "ETH", holdingIds: ["eth", "weth"], leaveGas: true };
}

function availableBalance(
  holdings: AssetHolding[],
  item: PolicyDraftItem,
): { symbol: string; amount: number; formatted: string; ok: boolean } {
  const unit = spendUnit(item);
  let total = 0;
  let anyOk = false;
  for (const id of unit.holdingIds) {
    const h = holdings.find((x) => x.id === id);
    if (!h?.balanceOk) continue;
    anyOk = true;
    let n = Number(h.balanceFormatted);
    if (!Number.isFinite(n)) n = 0;
    if (id === "eth" && unit.leaveGas) n = Math.max(0, n - 0.00008);
    total += n;
  }
  const formatted =
    unit.symbol === "USDC"
      ? total.toLocaleString(undefined, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        })
      : total > 0 && total < 0.0001
        ? total.toFixed(8)
        : total.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return { symbol: unit.symbol, amount: total, formatted, ok: anyOk };
}

function AmountField({
  item,
  holdings,
  loading,
  onChange,
  focusBind,
}: {
  item: PolicyDraftItem;
  holdings: AssetHolding[];
  loading: boolean;
  onChange: (next: PolicyDraftItem) => void;
  focusBind: FocusBind;
}) {
  const bal = useMemo(
    () => availableBalance(holdings, item),
    [holdings, item],
  );

  const setFrac = (frac: number) => {
    if (!bal.ok || bal.amount <= 0) return;
    const raw = bal.amount * frac;
    const v =
      bal.symbol === "USDC"
        ? (Math.floor(raw * 100) / 100).toFixed(2)
        : raw >= 1
          ? raw.toFixed(4)
          : raw.toFixed(6);
    onChange({ ...item, amount: v.replace(/\.?0+$/, "") || "0" });
  };

  return (
    <div className="sm:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={labelCls}>Amount ({bal.symbol})</span>
        <span className="font-mono text-[10px] text-mute">
          {loading
            ? "Reading Ledger…"
            : bal.ok
              ? `Available ${bal.formatted} ${bal.symbol}`
              : "Connect Ledger on Protect to see balance"}
        </span>
      </div>
      <div className="mt-1 flex gap-2">
        <input
          className={`${field} !mt-0 flex-1`}
          value={item.amount}
          placeholder={bal.symbol === "USDC" ? "e.g. 25" : "e.g. 0.5"}
          {...focusBind("amount")}
          onChange={(e) => onChange({ ...item, amount: e.target.value })}
        />
        <div className="flex shrink-0 gap-1">
          {(
            [
              ["25%", 0.25],
              ["50%", 0.5],
              ["MAX", 1],
            ] as const
          ).map(([label, frac]) => (
            <button
              key={label}
              type="button"
              disabled={!bal.ok || bal.amount <= 0}
              onClick={() => setFrac(frac)}
              className="min-h-9 border border-mist px-2.5 font-mono text-[10px] uppercase tracking-wider text-mute transition hover:border-signal hover:text-signal disabled:opacity-30"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {item.strategyType === "BUY_DIP" && (
        <p className="mt-1 text-[10px] text-mute">
          Buy-dip spends USDC for {item.asset || "ETH"} when the trigger hits.
        </p>
      )}
    </div>
  );
}

function ItemFields({
  item,
  holdings,
  holdingsLoading,
  onChange,
  label,
  focusBind,
}: {
  item: PolicyDraftItem;
  holdings: AssetHolding[];
  holdingsLoading: boolean;
  onChange: (next: PolicyDraftItem) => void;
  label: string;
  focusBind: FocusBind;
}) {
  return (
    <div className="space-y-2 border border-line bg-ink/30 p-3">
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
            {...focusBind("asset")}
            onChange={(e) => onChange({ ...item, asset: e.target.value })}
          />
        </label>
        <AmountField
          item={item}
          holdings={holdings}
          loading={holdingsLoading}
          onChange={onChange}
          focusBind={focusBind}
        />
        <label className={labelCls}>
          Slippage (bps)
          <input
            type="number"
            className={field}
            value={item.maxSlippageBps ?? 100}
            {...focusBind("maxSlippageBps")}
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
            {...focusBind("stopLossUsd")}
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
            {...focusBind("takeProfitUsd")}
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
          {...focusBind("reasoning")}
          onChange={(e) => onChange({ ...item, reasoning: e.target.value })}
        />
      </label>
    </div>
  );
}

export function PolicyDraftCard({
  draft,
  busy,
  ledgerAddress,
  onChange,
  onConfirm,
}: {
  draft: PolicyDraft;
  busy: boolean;
  ledgerAddress?: Address | null;
  onChange: (d: PolicyDraft) => void;
  onConfirm: (d: PolicyDraft, includeAddons: boolean) => void;
}) {
  const [includeAddons, setIncludeAddons] = useState(false);
  const [local, setLocal] = useState(() => withDraftStatus(draft));
  const [holdings, setHoldings] = useState<AssetHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const focusField = useRef<string | null>(null);
  const prevDraftRef = useRef(draft);

  // Diff-apply parent/agent draft — skip fields the user is mid-editing.
  useEffect(() => {
    const prev = prevDraftRef.current;
    prevDraftRef.current = draft;
    setLocal((cur) => {
      const keys: (keyof PolicyDraftItem)[] = [
        "strategyType",
        "asset",
        "amount",
        "stopLossUsd",
        "takeProfitUsd",
        "maxSlippageBps",
        "reasoning",
      ];
      const patch: Partial<PolicyDraftItem> = {};
      for (const k of keys) {
        if (draft.primary[k] !== prev.primary[k]) {
          if (focusField.current === k) continue;
          (patch as Record<string, unknown>)[k] = draft.primary[k];
        }
      }
      const strategyChanged =
        draft.primary.strategyType !== prev.primary.strategyType;
      const primary = strategyChanged
        ? {
            ...draft.primary,
            ...(focusField.current === "amount"
              ? { amount: cur.primary.amount }
              : {}),
            ...patch,
          }
        : { ...cur.primary, ...patch };
      return withDraftStatus({
        status: draft.status,
        questions: draft.questions,
        suggestions: draft.suggestions,
        addons: strategyChanged ? draft.addons : (draft.addons ?? cur.addons),
        primary,
      });
    });
  }, [draft]);

  useEffect(() => {
    if (!ledgerAddress) {
      setHoldings([]);
      return;
    }
    let dead = false;
    setHoldingsLoading(true);
    void fetchHoldings(ledgerAddress)
      .then((rows) => {
        if (!dead) setHoldings(rows);
      })
      .catch(() => {
        if (!dead) setHoldings([]);
      })
      .finally(() => {
        if (!dead) setHoldingsLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [ledgerAddress]);

  const sync = (next: PolicyDraft) => {
    const stamped = withDraftStatus(next);
    setLocal(stamped);
    onChange(stamped);
  };

  const canConfirm = local.status === "ready";

  const focusBind: FocusBind = (fieldName) => ({
    onFocus: () => {
      focusField.current = fieldName;
    },
    onBlur: () => {
      if (focusField.current === fieldName) focusField.current = null;
    },
  });

  return (
    <div className="space-y-3 border border-signal/30 bg-signal/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-paper">Policy draft</h3>
        <span
          className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            local.status === "ready"
              ? "bg-signal/15 text-signal"
              : "bg-warn/15 text-warn"
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
        holdings={holdings}
        holdingsLoading={holdingsLoading}
        focusBind={focusBind}
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
          {includeAddons &&
            local.addons.map((addon, i) => (
              <ItemFields
                key={`${addon.strategyType}-${i}`}
                label={`Addon ${i + 1}`}
                item={addon}
                holdings={holdings}
                holdingsLoading={holdingsLoading}
                focusBind={focusBind}
                onChange={(nextItem) => {
                  const addons = [...(local.addons ?? [])];
                  addons[i] = nextItem;
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
        Opens your USB Ledger OLED (Chrome/Edge). Master key never leaves
        Ledger; Key Ring holds keeper secrets.
      </p>
    </div>
  );
}
