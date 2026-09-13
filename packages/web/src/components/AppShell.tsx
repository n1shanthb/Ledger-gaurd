"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useProtectionOptional } from "@/components/ProtectionProvider";

const primary = [
  { href: "/protect", label: "Overview", exact: true },
  { href: "/protect/journey", label: "Protect" },
  { href: "/policies", label: "Protections" },
  { href: "/protect/activity", label: "Activity" },
  { href: "/protect/agent", label: "Agent" },
] as const;

const advanced = [
  { href: "/protect/research", label: "Market research" },
] as const;

function navActive(path: string, href: string, exact?: boolean) {
  if (exact) return path === href || path === "/console";
  return path === href || path.startsWith(`${href}/`);
}

export function AppShell({
  children,
  title,
  subtitle,
  eyebrow,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const protection = useProtectionOptional();

  return (
    <div className="shell-wash min-h-screen text-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-signal focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-display text-lg font-semibold tracking-tight text-paper"
            >
              LGA
            </Link>
            <nav className="hidden items-center gap-7 text-sm text-mute lg:flex" aria-label="Primary">
              {primary.map((item) => {
                const active = navActive(path, item.href, "exact" in item && item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "text-paper"
                        : "transition hover:text-paper"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="relative">
                <button
                  type="button"
                  className="text-mute transition hover:text-paper"
                  onClick={() => setAdvOpen((v) => !v)}
                  aria-expanded={advOpen}
                >
                  Advanced
                </button>
                {advOpen && (
                  <div className="absolute left-0 top-full z-20 mt-3 min-w-[12rem] border border-line bg-panel py-2">
                    {advanced.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2 text-sm text-mute hover:text-paper"
                        onClick={() => setAdvOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {protection && (
              <button
                type="button"
                onClick={() =>
                  protection.setMode(protection.mode === "demo" ? "live" : "demo")
                }
                className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-mute transition hover:text-signal sm:inline"
                aria-label={`Switch to ${protection.mode === "demo" ? "live" : "demo"} mode`}
              >
                {protection.mode}
              </button>
            )}
            <Link
              href="/protect/journey"
              className="hidden rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-signal sm:inline-flex"
            >
              Protect
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center border border-mist text-paper lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="font-mono text-xs tracking-widest">
                {open ? "CLOSE" : "MENU"}
              </span>
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-line bg-ink px-5 py-5 lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {primary.map((item) => {
                const active = navActive(path, item.href, "exact" in item && item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={
                      active
                        ? "py-3 text-paper"
                        : "py-3 text-mute hover:text-paper"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
              {advanced.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="py-3 text-mute hover:text-paper"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto max-w-6xl px-5 pb-20 pt-12 md:px-8 md:pt-16">
        {(title || subtitle) && (
          <header className="mb-12 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
              {eyebrow ?? "LGA"}
            </p>
            {title && (
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-4 text-base leading-relaxed text-mute md:text-lg">
                {subtitle}
              </p>
            )}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
