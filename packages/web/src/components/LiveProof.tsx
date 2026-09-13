import Link from "next/link";
import { BASESCAN_GPM, EXPLORER_URL, KILL_TX, POLICY_TX } from "@/lib/constants";

const proofs = [
  { label: "GuardianPolicyManager", href: BASESCAN_GPM, meta: "Base · v2" },
  { label: "Policy clear-sign tx", href: POLICY_TX, meta: "Ledger OLED" },
  { label: "Kill switch tx", href: KILL_TX, meta: "Delegation revoked" },
  { label: "Receipt Graph", href: EXPLORER_URL, meta: "Decentralized network" },
];

export function LiveProof() {
  return (
    <section id="proof" className="border-t border-line bg-panel px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-mute">
          Verified on Base
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-paper md:text-4xl">
          See a verified fill path — not a mock.
        </h2>
        <p className="mt-3 max-w-xl text-sm text-mute">
          These links are on-chain and Studio proof. Open Activity after you protect an
          asset to follow your own timeline.
        </p>
        <ul className="mt-12 divide-y divide-line border-y border-line">
          {proofs.map((p) => (
            <li key={p.label}>
              <a
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col gap-1 py-5 transition md:flex-row md:items-center md:justify-between"
              >
                <span className="font-display text-lg text-paper group-hover:text-signal">
                  {p.label}
                </span>
                <span className="font-mono text-xs text-mute">{p.meta} →</span>
              </a>
            </li>
          ))}
        </ul>
        <Link
          href="/protect/activity"
          className="mt-8 inline-flex min-h-11 items-center rounded-full border border-mist px-5 py-2 text-sm text-paper hover:border-paper"
        >
          Open Activity
        </Link>
      </div>
    </section>
  );
}
