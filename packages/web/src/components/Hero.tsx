import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden hero-wash">
      <div className="hero-grid absolute inset-0 animate-grain" />
      <div className="noise" />
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 md:justify-center md:px-8 md:pb-24">
        <p className="animate-rise font-mono text-xs uppercase tracking-[0.28em] text-signal">
          Ledger Guardian Agent
        </p>
        <h1 className="animate-rise-delay mt-6 max-w-4xl font-display text-[clamp(2.75rem,9vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-paper">
          Hardware-bounded exits for autonomous DeFi.
        </h1>
        <p className="animate-rise-late mt-6 max-w-xl text-lg leading-relaxed text-mute md:text-xl">
          Clear-sign stop-loss, take-profit, or buy-dip on Ledger. Six keeper
          roles pay Hedera x402, evaluate Pyth, and fill on Base — while The Graph
          drives which policies are live, gates risk via Messari standards, and
          indexes fills, kills, and payment audits you can query.
        </p>
        <div className="animate-rise-late mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/protect/journey"
            className="rounded-full bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-signal"
          >
            Protect an asset
          </Link>
          <Link
            href="/#proof"
            className="rounded-full border border-mist px-6 py-3 text-sm text-paper transition hover:border-paper"
          >
            See a verified fill
          </Link>
        </div>
      </div>
    </section>
  );
}
