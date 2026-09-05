const steps = [
  {
    k: "01",
    t: "Clear-sign on Ledger",
    d: "Stop-loss or take-profit bounds render on OLED. Master key never leaves the device.",
  },
  {
    k: "02",
    t: "Receipt Graph indexes",
    d: "Policies and kills sync to Subgraph Studio on Base — live, not mocked.",
  },
  {
    k: "03",
    t: "Keeper pays x402",
    d: "Agent settles HBAR via Blocky402, then evaluates Pyth and may execute.",
  },
  {
    k: "04",
    t: "Kill switch",
    d: "One Ledger tap revokes every policy and session key for that owner.",
  },
];

export function ProtocolStrip() {
  return (
    <section id="protocol" className="border-t border-line bg-ink px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-mute">Protocol</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-paper md:text-5xl">
          One path from OLED approval to indexed compliance.
        </h2>
        <ol className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map((s) => (
            <li key={s.k} className="border-t border-mist pt-6">
              <span className="font-mono text-sm text-signal">{s.k}</span>
              <h3 className="mt-3 font-display text-xl text-paper">{s.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mute">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
