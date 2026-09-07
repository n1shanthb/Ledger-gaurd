import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type PaymentHit = {
  policyId: string;
  trigger: string;
  tx?: string;
};

export type PaymentAttempt = {
  attemptId: string;
  paidAt: number;
  path: "trigger" | "quote";
  evaluated: number;
  executed: PaymentHit[];
  paymentResponse?: string | null;
  hashscanUrl?: string | null;
  hcsRef?: string | null;
  note?: string;
};

const MAX = 50;
const buf: PaymentAttempt[] = [];
const logPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "payments.jsonl",
);

function ensureLog() {
  const dir = dirname(logPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function recordPayment(attempt: PaymentAttempt) {
  buf.unshift(attempt);
  if (buf.length > MAX) buf.pop();
  try {
    ensureLog();
    appendFileSync(logPath, `${JSON.stringify(attempt)}\n`, "utf8");
  } catch (e) {
    console.warn("[lga] payments.jsonl write failed", e);
  }
}

export function recentPayments(limit = 20): PaymentAttempt[] {
  const n = Math.min(Math.max(limit, 1), MAX);
  if (buf.length >= n) return buf.slice(0, n);
  // hydrate from disk once if empty
  if (buf.length === 0 && existsSync(logPath)) {
    try {
      const lines = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines.slice(-MAX).reverse()) {
        try {
          buf.push(JSON.parse(line) as PaymentAttempt);
        } catch {
          /* skip */
        }
      }
    } catch {
      /* ignore */
    }
  }
  return buf.slice(0, n);
}

export function newAttemptId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
