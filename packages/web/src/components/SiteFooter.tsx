import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-12 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-2xl text-paper">LGA</p>
          <p className="mt-2 max-w-sm text-sm text-mute">
            Master key never leaves Ledger. Key Ring holds keeper secrets. The
            Graph is load-bearing — policies, receipts, audits, Messari compose.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-mute">
          <Link href="/console" className="hover:text-paper">
            Console
          </Link>
          <a href="https://ethglobal.com/events/ethonline2026" className="hover:text-paper">
            ETHOnline 2026
          </a>
        </div>
      </div>
    </footer>
  );
}
