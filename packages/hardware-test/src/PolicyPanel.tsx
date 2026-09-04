import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Address } from "viem";
import { BASE_TOKENS } from "./abi/GuardianPolicyManager";
import {
  getLedgerEthAddress,
  type ConnectionState,
  type LogEntry,
} from "./ledger";
import { signAndSendSetGuardianPolicy, type PolicyFormValues } from "./policyTx";

type Props = {
  conn: ConnectionState;
  pushLog: (level: LogEntry["level"], message: string) => void;
  accountIndex: number;
};

const DEFAULT_CONTRACT =
  import.meta.env.VITE_GUARDIAN_POLICY_MANAGER_ADDRESS ?? "";

export default function PolicyPanel({ conn, pushLog, accountIndex }: Props) {
  const [ledgerAddress, setLedgerAddress] = useState<Address | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PolicyFormValues>({
    token: BASE_TOKENS.WETH as Address,
    stopLossUsd: "2800",
    maxAmount: "0.1",
    maxAmountUnit: "eth",
    maxSlippagePercent: "0.5",
  });

  useEffect(() => {
    setLedgerAddress(null);
  }, [accountIndex]);

  const fetchAddress = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    pushLog("info", `Reading Ethereum address for Account ${accountIndex + 1}…`);
    try {
      const addr = await getLedgerEthAddress(conn.sessionId, accountIndex);
      setLedgerAddress(addr);
      pushLog("success", `Account ${accountIndex + 1} address: ${addr}`);
    } catch (err) {
      pushLog(
        "error",
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [conn, pushLog, accountIndex]);

  const handleSubmit = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    if (!contractAddress.startsWith("0x") || contractAddress.length !== 42) {
      pushLog("error", "Enter a valid GuardianPolicyManager contract address.");
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

      const result = await signAndSendSetGuardianPolicy(
        conn.sessionId,
        contractAddress as Address,
        from,
        form,
        (entry) => pushLog(entry.level, entry.message),
        accountIndex,
      );

      if (result.status === "success") {
        pushLog(
          "success",
          `Policy on-chain — https://basescan.org/tx/${result.txHash}`,
        );
      } else if (result.status === "rejected") {
        pushLog("warn", "Policy not submitted — rejected on device.");
      } else {
        pushLog("error", result.message);
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [conn, contractAddress, form, ledgerAddress, pushLog, accountIndex]);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <p style={{ color: "#94a3b8", margin: 0 }}>
        Clear-sign <Code>setGuardianPolicy()</Code> on Ledger, then broadcast to Base.
        Deploy contract first — see <Code>packages/contracts/README.md</Code>.
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

      <Row>
        <button onClick={() => void fetchAddress()} disabled={conn.status !== "connected"}>
          Read Account {accountIndex + 1} Address
        </button>
        {ledgerAddress && (
          <span style={{ fontFamily: "Consolas, monospace", fontSize: 12, color: "#94a3b8" }}>
            {ledgerAddress}
          </span>
        )}
      </Row>

      <label style={labelStyle}>
        Protected token
        <select
          style={inputStyle}
          value={form.token}
          onChange={(e) => setForm((f) => ({ ...f, token: e.target.value as Address }))}
        >
          <option value={BASE_TOKENS.WETH}>WETH</option>
          <option value={BASE_TOKENS.USDC}>USDC</option>
          <option value={BASE_TOKENS.cbETH}>cbETH</option>
        </select>
      </label>

      <label style={labelStyle}>
        Stop-loss trigger (USD, Pyth 1e8 scale)
        <input
          style={inputStyle}
          value={form.stopLossUsd}
          onChange={(e) => setForm((f) => ({ ...f, stopLossUsd: e.target.value }))}
        />
      </label>

      <label style={labelStyle}>
        Max trade amount
        <Row>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={form.maxAmount}
            onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))}
          />
          <select
            style={{ ...inputStyle, width: 100 }}
            value={form.maxAmountUnit}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                maxAmountUnit: e.target.value as "eth" | "token",
              }))
            }
          >
            <option value="eth">ETH</option>
            <option value="token">Token</option>
          </select>
        </Row>
      </label>

      <label style={labelStyle}>
        Max slippage (%)
        <input
          style={inputStyle}
          value={form.maxSlippagePercent}
          onChange={(e) => setForm((f) => ({ ...f, maxSlippagePercent: e.target.value }))}
        />
      </label>

      <button
        className="primary"
        disabled={conn.status !== "connected" || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? "Waiting on Ledger…" : "Clear Sign & Submit Policy"}
      </button>

      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
        ERC-7730 descriptor: <Code>clear-signing/guardian_policy.erc7730.json</Code>.
        Submit registry PR for human-readable OLED labels; until merged the Ethereum app shows call data.
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

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>;
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
