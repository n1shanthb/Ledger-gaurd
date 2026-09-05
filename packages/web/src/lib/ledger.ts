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

export async function disconnectLedger(sessionId: DeviceSessionId): Promise<void> {
  const dmk = getDMK();
  await dmk.disconnect({ sessionId }).catch(() => undefined);
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

/** Show a multi-line message on OLED (works without ERC-7730 registry). */
export function signMessageOnLedger(
  sessionId: DeviceSessionId,
  message: string,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<"approved" | "rejected"> {
  const signerEth = buildSignerEth(sessionId);
  const path = derivationPathForAccount(accountIndex);
  const { observable } = signerEth.signMessage(path, message);
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
            resolve("approved");
            break;
          case DeviceActionStatus.Stopped:
            onLog({ level: "warn", message: "OLED review rejected." });
            sub.unsubscribe();
            resolve("rejected");
            break;
          case DeviceActionStatus.Error: {
            const err = state.error;
            onLog({
              level: isUserRejection(err) ? "warn" : "error",
              message: formatLedgerError(err),
            });
            sub.unsubscribe();
            resolve("rejected");
            break;
          }
          default:
            break;
        }
      },
      error: (err) => {
        onLog({
          level: isUserRejection(err) ? "warn" : "error",
          message: formatLedgerError(err),
        });
        sub.unsubscribe();
        resolve("rejected");
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
