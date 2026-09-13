const steps = [
  {
    k: "01",
    t: "Connect Ledger",
    d: "Unlock, open Ethereum app, pick the account you want to protect.",
  },
  {
    k: "02",
    t: "Choose asset",
    d: "See balances and live Pyth spots for what you can cover.",
  },
  {
    k: "03",
    t: "Pick protection",
    d: "Stop-loss, take-profit, or buy-dip — limits you clear-sign.",
  },
  {
    k: "04",
    t: "Review & sign",
    d: "OLED shows what can move. Master key never leaves Ledger.",
  },
  {
    k: "05",
    t: "Keeper watches",
    d: "Safe to unplug. Autopilot loads live policies from Receipt Graph and watches bands without USB.",
  },
  {
    k: "06",
    t: "Paid attempt",
    d: "Hedera x402 pays for an evaluation attempt — payment is not a fill.",
  },
  {
    k: "07",
    t: "Graph audit trail",
    d: "Fills, kills, and payment audits index for Activity, Clerk NL queries, and explorers — Graph is how the system knows what happened.",
  },
];

export function ProtocolStrip() {
  return (
    <section id="how" className="border-t border-line bg-ink px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-mute">
          How it works
        </p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-paper md:text-5xl">
          Seven steps from device to Graph-backed fill.
        </h2>
        <ol className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {steps.map((s) => (
            <li key={s.k} className="border-t border-mist pt-5">
              <span className="font-mono text-sm text-accent">{s.k}</span>
              <h3 className="mt-2 font-display text-xl text-paper">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
