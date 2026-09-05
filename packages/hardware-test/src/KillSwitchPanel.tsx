import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Address } from "viem";
import { getLedgerEthAddress, type ConnectionState, type LogEntry } from "./ledger";
import { signAndSendKillSwitch } from "./killSwitchTx";

type Props = {
  conn: ConnectionState;
  pushLog: (level: LogEntry["level"], message: string) => void;
  accountIndex: number;
};

const DEFAULT_CONTRACT =
  import.meta.env.VITE_GUARDIAN_POLICY_MANAGER_ADDRESS ?? "";

export default function KillSwitchPanel({ conn, pushLog, accountIndex }: Props) {
  const [ledgerAddress, setLedgerAddress] = useState<Address | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLedgerAddress(null);
  }, [accountIndex]);

  const handleSubmit = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    if (!contractAddress.startsWith("0x") || contractAddress.length !== 42) {
      pushLog("error", "Enter a valid GuardianPolicyManager address (v2).");
      return;
    }

    setSubmitting(true);
    try {
      let from = ledgerAddress;
      if (!from) {
        from = await getLedgerEthAddress(conn.sessionId, accountIndex);
        setLedgerAddress(from);
        pushLog("info", `Using Account ${accountIndex + 1} address ${from}`);
      }

      const result = await signAndSendKillSwitch(
        conn.sessionId,
        contractAddress as Address,
        from,
        (entry) => pushLog(entry.level, entry.message),
        accountIndex,
      );

      if (result.status === "success") {
        pushLog("success", `Kill switch on-chain — https://basescan.org/tx/${result.txHash}`);
      } else if (result.status === "rejected") {
        pushLog("warn", "Kill switch not submitted — rejected on device.");
      } else {
        pushLog("error", result.message);
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [conn, contractAddress, ledgerAddress, pushLog, accountIndex]);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <p style={{ color: "#fbbf24", margin: 0 }}>
        One Ledger tap revokes every active policy for this account and kills keeper session keys.
        Needs the <strong>v2</strong> contract (<Code>killSwitch()</Code>).
      </p>

      <label style={labelStyle}>
        GuardianPolicyManager address (Base)
        <input
          style={inputStyle}
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value.trim())}
          placeholder="0x…"
        />
      </label>

      <button
        className="primary"
        disabled={conn.status !== "connected" || submitting}
        onClick={() => void handleSubmit()}
        style={{ background: "#b91c1c", borderColor: "#dc2626" }}
      >
        {submitting ? "Waiting on Ledger…" : "Clear Sign Kill Switch"}
      </button>

      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
        OLED: <Code>clear-signing/kill_switch.erc7730.json</Code> — “Revoke ALL guardian policies and disable keeper access”.
      </p>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code style={{ fontFamily: "Consolas, monospace", fontSize: 12, color: "#cbd5e1" }}>
      {children}
    </code>
  );
}

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#cbd5e1",
};

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #243044",
  background: "#111820",
  color: "#e8edf5",
  font: "inherit",
};
