import Link from "next/link";

const links = [
  { href: "/#protocol", label: "Protocol" },
  { href: "/#pillars", label: "Pillars" },
  { href: "/console", label: "Console" },
];

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-paper">
          LGA
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-mute md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-paper">
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/console"
          className="rounded-full bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:brightness-110"
        >
          Open console
        </Link>
      </div>
    </header>
  );
}
