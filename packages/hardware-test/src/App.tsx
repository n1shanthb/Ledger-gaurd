import { useCallback, useEffect, useRef, useState } from "react";
import PolicyPanel from "./PolicyPanel";
import {
  connectLedger,
  disconnectLedger,
  derivationPathForAccount,
  isWebHidSupported,
  makeLogEntry,
  promptYesNoOnLedger,
  type ConnectionState,
  type LogEntry,
  YES_NO_MESSAGE,
} from "./ledger";

type Tab = "hello" | "policy";

const ACCOUNT_OPTIONS = [
  { index: 0, label: "Account 1 (default — avoid if this holds main funds)" },
  { index: 1, label: "Account 2 (recommended for LGA testing)" },
  { index: 2, label: "Account 3" },
  { index: 3, label: "Account 4" },
  { index: 4, label: "Account 5" },
] as const;

export default function App() {
  const [tab, setTab] = useState<Tab>("policy");
  const [accountIndex, setAccountIndex] = useState(1);
  const [conn, setConn] = useState<ConnectionState>({ status: "disconnected" });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [prompting, setPrompting] = useState(false);
  const sessionRef = useRef<string | null>(null);

  const pushLog = useCallback((level: LogEntry["level"], message: string) => {
    const entry = makeLogEntry(level, message);
    setLogs((prev) => [entry, ...prev]);
    console.log(`[LGA ${entry.ts}] ${level.toUpperCase()}: ${message}`);
  }, []);

  const handleConnect = useCallback(async () => {
    if (!isWebHidSupported()) {
      pushLog("error", "WebHID not supported — use Chrome or Edge on desktop.");
      return;
    }

    setConn({ status: "connecting" });
    pushLog("info", "Opening WebHID picker… plug in Ledger and unlock it.");

    try {
      const sessionId = await connectLedger();
      sessionRef.current = sessionId;
      setConn({ status: "connected", sessionId });
      pushLog("success", `Connected — session ${sessionId.slice(0, 8)}…`);
    } catch (err) {
      sessionRef.current = null;
      setConn({ status: "disconnected" });
      pushLog("error", `Connect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [pushLog]);

  const handleDisconnect = useCallback(async () => {
    if (sessionRef.current) {
      await disconnectLedger(sessionRef.current);
      pushLog("info", "Disconnected.");
    }
    sessionRef.current = null;
    setConn({ status: "disconnected" });
  }, [pushLog]);

  const handlePrompt = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }

    setPrompting(true);
    pushLog("info", "Sending message to Ledger OLED…");
    pushLog("info", `Message:\n${YES_NO_MESSAGE}`);

    try {
      const { result, signature } = await promptYesNoOnLedger(
        conn.sessionId,
        (entry) => pushLog(entry.level, entry.message),
        accountIndex,
      );

      pushLog(
        result === "YES" ? "success" : result === "NO" ? "warn" : "error",
        `Final answer: ${result}${signature ? ` (sig ${signature.slice(0, 18)}…)` : ""}`,
      );
    } finally {
      setPrompting(false);
    }
  }, [conn, pushLog, accountIndex]);

  useEffect(() => {
    if (!isWebHidSupported()) return;

    const onConnect = () => pushLog("info", "HID device plugged in.");
    const onDisconnect = () => {
      pushLog("warn", "HID device unplugged.");
      sessionRef.current = null;
      setConn({ status: "disconnected" });
    };

    navigator.hid.addEventListener("connect", onConnect);
    navigator.hid.addEventListener("disconnect", onDisconnect);
    return () => {
      navigator.hid.removeEventListener("connect", onConnect);
      navigator.hid.removeEventListener("disconnect", onDisconnect);
    };
  }, [pushLog]);

  const badge =
    conn.status === "connecting"
      ? "CONNECTING…"
      : conn.status === "connected"
        ? "CONNECTED (CLEAR SIGNING READY)"
        : "DISCONNECTED (HARDWARE LOCKED)";

  const badgeColor =
    conn.status === "connected"
      ? "#16a34a"
      : conn.status === "connecting"
        ? "#d97706"
        : "#dc2626";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Ledger Guardian Agent</h1>
      <p style={{ color: "#94a3b8" }}>
        Hardware test + ERC-7730 <code>setGuardianPolicy()</code> on Base.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <TabButton active={tab === "policy"} onClick={() => setTab("policy")}>
          Set Policy
        </TabButton>
        <TabButton active={tab === "hello"} onClick={() => setTab("hello")}>
          Hello Test
        </TabButton>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 8,
          border: `1px solid ${badgeColor}44`,
          color: badgeColor,
          fontFamily: "Consolas, monospace",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: badgeColor }} />
        {badge}
      </div>

      <section
        style={{
          background: accountIndex === 0 ? "#2a1a0a" : "#111820",
          border: `1px solid ${accountIndex === 0 ? "#92400e" : "#243044"}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <label style={{ display: "grid", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
          Ledger Ethereum account
          <select
            value={accountIndex}
            onChange={(e) => setAccountIndex(Number(e.target.value))}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #243044",
              background: "#0f1419",
              color: "#e8edf5",
              font: "inherit",
            }}
          >
            {ACCOUNT_OPTIONS.map(({ index, label }) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94a3b8", fontFamily: "Consolas, monospace" }}>
          Path: m/{derivationPathForAccount(accountIndex)}
        </p>
        {accountIndex === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#fbbf24" }}>
            Account 1 is often your main wallet. Create Account 2 in Ledger Live and fund it with ~$2 Base ETH for testing.
          </p>
        ) : (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
            Fund this address with a small amount of Base ETH for gas only — no need to move main holdings.
          </p>
        )}
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <button
          className="primary"
          onClick={() => void handleConnect()}
          disabled={conn.status !== "disconnected"}
        >
          Connect Ledger
        </button>
        {tab === "hello" && (
          <button
            className="primary"
            onClick={() => void handlePrompt()}
            disabled={conn.status !== "connected" || prompting}
          >
            {prompting ? "Waiting on device…" : "Send Hi + YES/NO"}
          </button>
        )}
        <button onClick={() => void handleDisconnect()} disabled={conn.status !== "connected"}>
          Disconnect
        </button>
      </div>

      {tab === "policy" ? (
        <PolicyPanel conn={conn} pushLog={pushLog} accountIndex={accountIndex} />
      ) : (
        <section
          style={{
            background: "#111820",
            border: "1px solid #243044",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Message on Ledger OLED</h2>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "Consolas, monospace", fontSize: 13, color: "#cbd5e1" }}>
            {YES_NO_MESSAGE}
          </pre>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Event log</h2>
        {logs.length === 0 ? (
          <p style={{ color: "#64748b" }}>No events yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {logs.map((log) => (
              <li
                key={log.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid #1e293b",
                  fontFamily: "Consolas, monospace",
                  fontSize: 13,
                  color:
                    log.level === "success"
                      ? "#4ade80"
                      : log.level === "warn"
                        ? "#fbbf24"
                        : log.level === "error"
                          ? "#f87171"
                          : "#cbd5e1",
                }}
              >
                <span style={{ color: "#64748b" }}>[{log.ts}]</span> {log.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid #243044",
        background: active ? "#1d4ed8" : "#141b24",
        borderColor: active ? "#2563eb" : "#243044",
        color: "#e8edf5",
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
