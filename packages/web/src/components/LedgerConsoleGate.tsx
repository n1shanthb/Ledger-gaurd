"use client";

import dynamic from "next/dynamic";

const LedgerConsole = dynamic(
  () => import("./LedgerConsole").then((m) => m.LedgerConsole),
  {
    ssr: false,
    loading: () => (
      <section className="mt-10">
        <p className="font-mono text-xs text-mute">Loading Ledger module…</p>
      </section>
    ),
  },
);

export function LedgerConsoleGate() {
  return <LedgerConsole />;
}
