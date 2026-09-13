import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";

export type ConnectionState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; sessionId: DeviceSessionId; modelId?: string };

export type LogEntry = {
  id: string;
  ts: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
};

export function derivationPathForAccount(accountIndex: number): string {
  if (!Number.isInteger(accountIndex) || accountIndex < 0 || accountIndex > 99) {
    throw new Error("Account index must be an integer from 0 to 99");
  }
  return `44'/60'/0'/0/${accountIndex}`;
}

const USER_REJECT_ERROR_CODES = new Set(["6982", "6985"]);

let dmkSingleton: DeviceManagementKit | null = null;
/** Shared across Protect + Agent room so clear-sign reuses an open WebHID session. */
let activeSessionId: DeviceSessionId | null = null;

export function getActiveLedgerSession(): DeviceSessionId | null {
  return activeSessionId;
}

export function getDMK(): DeviceManagementKit {
  if (!dmkSingleton) {
    dmkSingleton = new DeviceManagementKitBuilder()
      .addTransport(webHidTransportFactory)
      .build();
  }
  return dmkSingleton;
}

export function buildSignerEth(sessionId: DeviceSessionId) {
  const dmk = getDMK();
  const originToken = process.env.NEXT_PUBLIC_LEDGER_ORIGIN_TOKEN;
  return new SignerEthBuilder({
    dmk,
    sessionId,
    ...(originToken ? { originToken } : {}),
  }).build();
}

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export async function connectLedger(): Promise<DeviceSessionId> {
  const dmk = getDMK();

  return new Promise((resolve, reject) => {
    const sub = dmk.startDiscovering({}).subscribe({
      next: async (device) => {
        try {
          sub.unsubscribe();
          const sessionId = await dmk.connect({ device });
          activeSessionId = sessionId;
          resolve(sessionId);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => {
        sub.unsubscribe();
        reject(err);
      },
    });
  });
}

/** Prefer an open Protect session; otherwise open WebHID picker. */
export async function ensureLedgerSession(): Promise<DeviceSessionId> {
  if (activeSessionId) return activeSessionId;
  return connectLedger();
}

export async function disconnectLedger(sessionId: DeviceSessionId): Promise<void> {
  const dmk = getDMK();
  await dmk.disconnect({ sessionId }).catch(() => undefined);
  if (activeSessionId === sessionId) activeSessionId = null;
}

export function formatLedgerError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e._tag === "string") parts.push(e._tag);
    if (typeof e.errorCode === "string") parts.push(`code ${e.errorCode}`);
    if (typeof e.message === "string") parts.push(e.message);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? "Unknown error");
}

export function isUserRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  if (e._tag === "RefusedByUserDAError") return true;
  if (typeof e.errorCode === "string" && USER_REJECT_ERROR_CODES.has(e.errorCode)) {
    return true;
  }
  const msg = formatLedgerError(error).toLowerCase();
  return (
    msg.includes("refused") ||
    msg.includes("reject") ||
    msg.includes("cancel") ||
    msg.includes("6985") ||
    msg.includes("6982") ||
    msg.includes("condition not satisfied") ||
    msg.includes("canceled by user")
  );
}

export async function getLedgerEthAddress(
  sessionId: DeviceSessionId,
  accountIndex = 0,
): Promise<`0x${string}`> {
  const signerEth = buildSignerEth(sessionId);
  const path = derivationPathForAccount(accountIndex);
  const { observable } = signerEth.getAddress(path);

  return new Promise((resolve, reject) => {
    const sub = observable.subscribe({
      next: (state) => {
        if (state.status === DeviceActionStatus.Completed) {
          sub.unsubscribe();
          resolve(state.output.address);
        } else if (state.status === DeviceActionStatus.Error) {
          sub.unsubscribe();
          reject(state.error);
        } else if (state.status === DeviceActionStatus.Stopped) {
          sub.unsubscribe();
          reject(new Error("Address fetch cancelled"));
        }
      },
      error: (err) => {
        sub.unsubscribe();
        reject(err);
      },
    });
  });
}

export type OledReviewResult =
  | { status: "approved" }
  | { status: "rejected" }
  | { status: "error"; message: string };

function resolveOledError(err: unknown): OledReviewResult {
  if (isUserRejection(err)) return { status: "rejected" };
  const message = formatLedgerError(err);
  // InvalidStatusWordError ≠ user reject (often non-ASCII msg / app glitch)
  if (/InvalidStatusWord/i.test(message)) {
    return {
      status: "error",
      message:
        "OLED review failed (InvalidStatusWord). Quit+reopen Ethereum app, then retry. If it keeps failing, Settings → Blind signing → Enabled.",
    };
  }
  return { status: "error", message };
}

/** Show a multi-line message on OLED (works without ERC-7730 registry). */
export function signMessageOnLedger(
  sessionId: DeviceSessionId,
  message: string,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<OledReviewResult> {
  const signerEth = buildSignerEth(sessionId);
  const path = derivationPathForAccount(accountIndex);
  // Device expects printable ASCII; strip anything else before APDU.
  const safe = message.replace(/[^\x20-\x7E\n]/g, "");
  const { observable } = signerEth.signMessage(path, safe);
  let lastInteraction: string | null = null;

  return new Promise((resolve) => {
    const sub = observable.subscribe({
      next: (state) => {
        switch (state.status) {
          case DeviceActionStatus.Pending: {
            const interaction = String(
              state.intermediateValue?.requiredUserInteraction ?? "unknown",
            );
            if (interaction !== lastInteraction) {
              lastInteraction = interaction;
              onLog({
                level: "info",
                message: `OLED review — ${interaction}. Scroll & approve on device.`,
              });
            }
            break;
          }
          case DeviceActionStatus.Completed:
            onLog({ level: "success", message: "OLED review approved." });
            sub.unsubscribe();
            resolve({ status: "approved" });
            break;
          case DeviceActionStatus.Stopped:
            onLog({ level: "warn", message: "OLED review rejected." });
            sub.unsubscribe();
            resolve({ status: "rejected" });
            break;
          case DeviceActionStatus.Error: {
            const err = state.error;
            const out = resolveOledError(err);
            onLog({
              level: out.status === "rejected" ? "warn" : "error",
              message: out.status === "error" ? out.message : formatLedgerError(err),
            });
            sub.unsubscribe();
            resolve(out);
            break;
          }
          default:
            break;
        }
      },
      error: (err) => {
        const out = resolveOledError(err);
        onLog({
          level: out.status === "rejected" ? "warn" : "error",
          message: out.status === "error" ? out.message : formatLedgerError(err),
        });
        sub.unsubscribe();
        resolve(out);
      },
    });
  });
}

export function makeLogEntry(level: LogEntry["level"], message: string): LogEntry {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toLocaleTimeString(),
    level,
    message,
  };
}
