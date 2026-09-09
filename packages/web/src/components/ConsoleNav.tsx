"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/console", label: "Overview", exact: true },
  { href: "/console/ledger", label: "Ledger" },
  { href: "/console/agent", label: "Agent" },
  { href: "/console/compose", label: "Compose" },
  { href: "/console/receipts", label: "Receipts" },
  { href: "/policies", label: "Policies" },
];

export function ConsoleNav() {
  const path = usePathname();

  return (
    <nav className="mt-8 flex flex-wrap gap-2 border-b border-line pb-4">
      {items.map((item) => {
        const active = item.exact
          ? path === item.href
          : path === item.href || path.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-full bg-signal px-3.5 py-1.5 text-xs font-medium text-ink"
                : "rounded-full border border-mist px-3.5 py-1.5 text-xs text-mute hover:border-paper hover:text-paper"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
