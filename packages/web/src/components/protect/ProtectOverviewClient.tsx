"use client";

import Link from "next/link";
import { SystemReadiness } from "@/components/protect/SystemReadiness";
import { useProtection } from "@/components/ProtectionProvider";

export function ProtectOverviewClient() {
  const {
    connected,
    ledgerAddress,
    mode,
    stage,
    killConfirmed,
    lastPolicyTx,
  } = useProtection();

  return (
    <div className="space-y-10">
      <SystemReadiness ledgerConnected={connected} />
      {lastPolicyTx && (
        <div className="border-l-2 border-warn/60 pl-4" role="status">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-warn">
            Pending Graph index
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Clear-sign landed on Base. Receipt Graph can lag the tip — the policy
            may not show as active until indexing catches up. Check Basescan
            meanwhile.
          </p>
          <a
            href={`https://basescan.org/tx/${lastPolicyTx}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block font-mono text-xs text-signal hover:underline"
          >
            {lastPolicyTx.slice(0, 10)}…{lastPolicyTx.slice(-8)} →
          </a>
        </div>
      )}
      <div className="border-t border-line pt-8">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
          Next action
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-paper md:text-4xl">
          {killConfirmed
            ? "Protections stopped — start a new journey when ready"
            : connected
              ? stage === "monitor" || stage === "outcome"
                ? "Continue monitoring or open Activity"
                : "Continue your protection setup"
              : "Connect Ledger and protect an asset"}
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute md:text-base">
          {ledgerAddress
            ? `${ledgerAddress.slice(0, 6)}…${ledgerAddress.slice(-4)} · ${mode} mode`
            : "Master key never leaves Ledger. Key Ring holds keeper secrets."}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/protect/journey"
            className="rounded-full bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-signal"
          >
            {connected ? "Continue setup" : "Create protection"}
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
            {connected ? "Ledger linked" : "Not connected"}
          </span>
        </div>
      </div>
    </div>
  );
}
