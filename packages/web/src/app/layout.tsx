import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import { QueryProvider } from "@/components/QueryProvider";
import { ProtectionProvider } from "@/components/ProtectionProvider";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LGA — Ledger Guardian Agent",
  description:
    "Hardware-bounded DeFi exits: Ledger clear-sign, six-role keeper, Hedera x402, Key Ring secrets. The Graph powers live policies, Messari risk gates, fills, kills, and payment audits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} font-sans antialiased`}
      >
        <QueryProvider>
          <ProtectionProvider>{children}</ProtectionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
