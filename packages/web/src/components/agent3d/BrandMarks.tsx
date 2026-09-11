"use client";

/** Simplified brand marks for dock HUD (not official trademark assets). */

export function GraphMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#6F4CFF" opacity="0.9" />
      <path
        fill="#fff"
        d="M16 6.5c-2.2 0-4 1.6-4 3.6v1.2c-2.4.5-4.2 2.5-4.2 5 0 .4 0 .8.1 1.1L6.2 22h3.1l1.4-3.6c.7.4 1.5.6 2.3.6h2v3h3v-3h.5c2.8 0 5-2.2 5-5 0-2.4-1.8-4.4-4.2-5V10c0-2 1.8-3.5 4-3.5V6.5h-.1C21.8 6.5 16 6.5 16 6.5zm0 8.2c1.4 0 2.5 1.1 2.5 2.5S17.4 19.7 16 19.7s-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5z"
      />
    </svg>
  );
}

export function MessariMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0B1220" />
      <path
        fill="#E8ECF1"
        d="M7 23V9h3.2l3.6 8.4L17.4 9H21v14h-2.8v-8.2L14.8 23h-2.4l-3.4-8.2V23H7z"
      />
      <path fill="#5B8DEF" d="M23 9h2.4v14H23z" />
    </svg>
  );
}

export function HederaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#1a1208" />
      <path
        fill="#C4A484"
        d="M10 8h2.6v6.2H19.4V8H22v16h-2.6v-6.8H12.6V24H10V8z"
      />
      <path fill="#FF9900" d="M8 14.2h16v1.8H8zM8 17h16v1.8H8z" opacity="0.85" />
    </svg>
  );
}

/** Ledger wordmark-style mark (simplified). */
export function LedgerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#000" />
      <rect x="7" y="8" width="18" height="16" rx="2" fill="#111" stroke="#b8f000" strokeWidth="1.2" />
      <rect x="10" y="11" width="12" height="7" rx="0.8" fill="#b8f000" opacity="0.9" />
      <circle cx="16" cy="21.5" r="1.2" fill="#333" />
    </svg>
  );
}

