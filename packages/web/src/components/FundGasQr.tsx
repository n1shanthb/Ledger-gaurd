"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Address } from "viem";

type Props = {
  address: Address;
};

export function FundGasQr({ address }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-sm text-amber-200">
        This account has <span className="font-semibold">0 ETH on Base</span> — need
        a little for gas (~$1–2). Network must be <strong>Base</strong>, not Ethereum
        mainnet.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink"
        >
          {open ? "Hide QR" : "Show QR to fund"}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-full border border-mist px-4 py-2 text-sm text-paper hover:border-paper"
        >
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>
      {open && (
        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={address} size={168} level="M" includeMargin={false} />
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs break-all text-paper">{address}</p>
            <p className="text-xs text-mute">
              Scan with any wallet → send ETH · chain: Base (8453)
            </p>
            <a
              href={`https://basescan.org/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-signal hover:underline"
            >
              View on Basescan →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
