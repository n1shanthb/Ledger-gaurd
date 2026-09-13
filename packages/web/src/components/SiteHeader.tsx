"use client";

import Link from "next/link";
import { useState } from "react";

const marketing = [
  { href: "/#how", label: "How it works" },
  { href: "/#proof", label: "Live proof" },
  { href: "/protect", label: "Overview" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-paper"
        >
          LGA
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-mute md:flex">
          {marketing.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-paper">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/protect/journey"
            className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-signal"
          >
            Protect an asset
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center border border-mist px-3 font-mono text-[10px] tracking-widest text-paper md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "CLOSE" : "MENU"}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-ink/95 px-5 py-4 backdrop-blur md:hidden">
          <nav className="flex flex-col">
            {marketing.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm text-mute hover:text-paper"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
