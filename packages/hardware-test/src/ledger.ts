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

export type YesNoResult = "YES" | "NO" | "CANCELLED" | "ERROR";

export type LogEntry = {
  id: string;
  ts: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
};

/** Standard Ethereum BIP-44 path; last segment is the account index (0 = Account 1 in Ledger Live). */
export function derivationPathForAccount(accountIndex: number): string {
  if (!Number.isInteger(accountIndex) || accountIndex < 0 || accountIndex > 99) {
    throw new Error("Account index must be an integer from 0 to 99");
  }
  return `44'/60'/0'/0/${accountIndex}`;
}

/** @deprecated Use derivationPathForAccount(accountIndex) */
export const DERIVATION_PATH = derivationPathForAccount(0);

/** Ledger Ethereum app status words when user rejects on device */
const USER_REJECT_ERROR_CODES = new Set(["6982", "6985"]);

/** Message shown on Ledger OLED — scroll with device buttons if needed */
export const YES_NO_MESSAGE = [
  "Hi from LGA!",
  "",
  "Do you want to continue?",
  "",
  "Approve  = YES",
  "Reject   = NO",
].join("\n");

let dmkSingleton: DeviceManagementKit | null = null;

export function getDMK(): DeviceManagementKit {
  if (!dmkSingleton) {
    dmkSingleton = new DeviceManagementKitBuilder()
      .addTransport(webHidTransportFactory)
      .build();
  }
  return dmkSingleton;
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
  const dmk = getDMK();
  const signerEth = new SignerEthBuilder({ dmk, sessionId }).build();
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

export function promptYesNoOnLedger(
  sessionId: DeviceSessionId,
  onLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  accountIndex = 0,
): Promise<{ result: YesNoResult; signature?: string }> {
  const dmk = getDMK();
  const signerEth = new SignerEthBuilder({ dmk, sessionId }).build();
  const path = derivationPathForAccount(accountIndex);
  const { observable } = signerEth.signMessage(path, YES_NO_MESSAGE);
  let lastLoggedInteraction: string | null = null;

  return new Promise((resolve) => {
    const sub = observable.subscribe({
      next: (state) => {
        switch (state.status) {
          case DeviceActionStatus.NotStarted:
            onLog({ level: "info", message: "Waiting for Ledger…" });
            break;

          case DeviceActionStatus.Pending: {
            const interaction = String(
              state.intermediateValue?.requiredUserInteraction ?? "unknown",
            );
            if (interaction !== lastLoggedInteraction) {
              lastLoggedInteraction = interaction;
              onLog({
                level: "info",
                message: `Ledger waiting — ${interaction}. Check device screen.`,
              });
            }
            console.log("[LGA] Pending:", state);
            break;
          }

          case DeviceActionStatus.Completed: {
            const { r, s, v } = state.output;
            const signature = `0x${r.slice(2)}${s.slice(2)}${v.toString(16).padStart(2, "0")}`;
            onLog({ level: "success", message: "User pressed APPROVE → logged as YES" });
            console.log("[LGA] YES — signature:", { r, s, v, signature });
            sub.unsubscribe();
            resolve({ result: "YES", signature });
            break;
          }

          case DeviceActionStatus.Stopped:
            onLog({ level: "warn", message: "User pressed REJECT → logged as NO" });
            console.log("[LGA] NO — action stopped");
            sub.unsubscribe();
            resolve({ result: "NO" });
            break;

          case DeviceActionStatus.Error: {
            const err = state.error;
            if (isUserRejection(err)) {
              onLog({
                level: "warn",
                message: `User pressed REJECT → logged as NO (${formatLedgerError(err)})`,
              });
              console.log("[LGA] NO — user rejection:", err);
              sub.unsubscribe();
              resolve({ result: "NO" });
              break;
            }

            const msg = formatLedgerError(err);
            onLog({ level: "error", message: `Ledger error: ${msg}` });
            console.error("[LGA] Error:", err);
            sub.unsubscribe();
            resolve({ result: "ERROR" });
            break;
          }

          default:
            break;
        }
      },
      error: (err) => {
        if (isUserRejection(err)) {
          onLog({ level: "warn", message: "User pressed REJECT → logged as NO" });
          console.log("[LGA] NO — observable rejection:", err);
          sub.unsubscribe();
          resolve({ result: "NO" });
          return;
        }

        onLog({ level: "error", message: `Observable error: ${formatLedgerError(err)}` });
        console.error("[LGA] Observable error:", err);
        sub.unsubscribe();
        resolve({ result: "ERROR" });
      },
    });
  });
}

export function makeLogEntry(
  level: LogEntry["level"],
  message: string,
): LogEntry {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toLocaleTimeString(),
    level,
    message,
  };
}
