"use client";

import type { FillNotice } from "@/lib/fillNotice";

export function FillCongratsModal({
  notice,
  onClose,
}: {
  notice: FillNotice;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/92 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fill-congrats-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-signal/50 bg-ink px-5 py-7 sm:px-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-signal">
          Fill confirmed
        </p>
        <h2
          id="fill-congrats-title"
          className="mt-3 font-display text-3xl tracking-tight text-paper sm:text-4xl"
        >
          Congratulations — protection filled
        </h2>
        <p className="mt-2 text-sm text-mute">
          Indexed on Receipt Graph. Master key never left Ledger.
        </p>

        <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
          <Row label="Trigger" value={notice.trigger} />
          <Row label="Pyth spot" value={notice.pyth} mono />
          <Row label="Fill price" value={notice.fill} mono />
          {notice.slippage != null && (
            <Row label="Slippage" value={notice.slippage} mono />
          )}
          <Row
            label="Compliant"
            value={notice.compliant ? "Yes — within clear-signed caps" : "No"}
            tone={notice.compliant ? "ok" : "bad"}
          />
          {notice.policyId && (
            <Row
              label="Policy"
              value={`${notice.policyId.slice(0, 10)}…${notice.policyId.slice(-6)}`}
              mono
            />
          )}
          <Row label="When" value={notice.when} />
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">
              Transaction
            </dt>
            <dd className="mt-1">
              <a
                href={`https://basescan.org/tx/${notice.tx}`}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-signal hover:underline"
              >
                {notice.tx}
              </a>
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={`https://basescan.org/tx/${notice.tx}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex border border-signal bg-signal/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-signal hover:bg-signal/25"
          >
            Open Basescan
          </a>
          <a
            href="/protect/activity"
            className="inline-flex border border-mist px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-mute hover:border-paper hover:text-paper"
          >
            Activity
          </a>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto font-mono text-[11px] uppercase tracking-wider text-mute hover:text-paper"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-mute">
        {label}
      </dt>
      <dd
        className={`text-right text-paper ${mono ? "font-mono text-xs" : ""} ${
          tone === "ok" ? "text-signal" : tone === "bad" ? "text-kill" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
