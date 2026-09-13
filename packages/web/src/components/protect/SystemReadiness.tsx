"use client";

import { useCallback, useEffect, useState } from "react";

const keeperBase =
  process.env.NEXT_PUBLIC_KEEPER_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:3001";

type Row = {
  id: string;
  label: string;
  ok: boolean | null;
  action: string;
};

export function SystemReadiness({
  ledgerConnected,
  hidOk,
}: {
  ledgerConnected?: boolean;
  hidOk?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);

  const tick = useCallback(async () => {
    const next: Row[] = [];

    next.push({
      id: "ledger",
      label: "Ledger",
      ok: hidOk === false ? false : ledgerConnected ?? null,
      action:
        hidOk === false
          ? "Chrome/Edge desktop + USB"
          : ledgerConnected
            ? "Connected"
            : "Unlock · Ethereum app · Connect",
    });

    try {
      const res = await fetch(`${keeperBase}/health`, { cache: "no-store" });
      next.push({
        id: "keeper",
        label: "Keeper",
        ok: res.ok,
        action: res.ok ? "Reachable" : "Unavailable — monitoring paused",
      });
    } catch {
      next.push({
        id: "keeper",
        label: "Keeper",
        ok: false,
        action: "Unavailable — monitoring paused",
      });
    }

    next.push({
      id: "graph",
      label: "Receipt Graph",
      ok: null,
      action: "Live policies · fills · audits",
    });

    setRows(next);
  }, [hidOk, ledgerConnected]);

  useEffect(() => {
    void tick();
    const id = setInterval(() => void tick(), 25_000);
    return () => clearInterval(id);
  }, [tick]);

  const worst = rows.some((r) => r.ok === false);

  return (
    <div
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-line pb-5"
      role="status"
      aria-live="polite"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        Status
      </span>
      {rows.map((r) => (
        <span key={r.id} className="text-sm">
          <span className="text-mute">{r.label}</span>{" "}
          <span
            className={
              r.ok === true
                ? "text-signal"
                : r.ok === false
                  ? "text-kill"
                  : "text-paper/70"
            }
          >
            {r.action}
          </span>
        </span>
      ))}
      {worst && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-warn">
          Action needed
        </span>
      )}
    </div>
  );
}
