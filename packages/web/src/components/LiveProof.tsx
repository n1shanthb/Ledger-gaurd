import { BASESCAN_GPM, KILL_TX, POLICY_TX, STUDIO_URL } from "@/lib/constants";

const proofs = [
  { label: "GuardianPolicyManager", href: BASESCAN_GPM, meta: "Base · v2" },
  { label: "Policy clear-sign tx", href: POLICY_TX, meta: "Ledger OLED" },
  { label: "Kill switch tx", href: KILL_TX, meta: "Delegation revoked" },
  { label: "Receipt Graph Studio", href: STUDIO_URL, meta: "Live subgraph" },
];

export function LiveProof() {
  return (
    <section className="border-t border-line bg-panel px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-mute">Live on Base</p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-paper md:text-4xl">
          Mainnet proof, not a mock.
        </h2>
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
      </div>
    </section>
  );
}
