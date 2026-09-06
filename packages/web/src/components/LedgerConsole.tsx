"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { FundGasQr } from "@/components/FundGasQr";
import { BASE_TOKENS } from "@/lib/abi";
import { GPM_V2, usdFrom1e8 } from "@/lib/constants";
import { fetchHoldings, type AssetHolding } from "@/lib/holdings";
import { signAndSendKillSwitch } from "@/lib/killSwitchTx";
import {
  connectLedger,
  disconnectLedger,
  getLedgerEthAddress,
  isWebHidSupported,
  makeLogEntry,
  type ConnectionState,
  type LogEntry,
} from "@/lib/ledger";
import { fetchOwnerReceipts, fetchPythBand } from "@/lib/fillWatch";
import {
  enableKeeperSession,
  instantTriggerDefaults,
} from "@/lib/prepFill";
import {
  formatOledPreviewRows,
  suggestStopFromSpot,
} from "@/lib/oledPreview";
import {
  signAndSendSetGuardianPolicy,
  type PolicyFormValues,
} from "@/lib/policyTx";

type Tab = "policy" | "kill";

const ACCOUNTS = [
  { index: 0, label: "Account 1" },
  { index: 1, label: "Account 2 (test)" },
  { index: 2, label: "Account 3" },
  { index: 3, label: "Account 4" },
];

const field =
  "mt-1.5 w-full rounded-lg border border-mist bg-panel px-3 py-2 text-sm text-paper outline-none focus:border-signal";
const label = "block text-xs font-medium text-mute";

export function LedgerConsole() {
  const [tab, setTab] = useState<Tab>("policy");
  const [accountIndex, setAccountIndex] = useState(1);
  const [conn, setConn] = useState<ConnectionState>({ status: "disconnected" });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ledgerAddress, setLedgerAddress] = useState<Address | null>(null);
  const [contractAddress, setContractAddress] = useState<string>(GPM_V2);
  const [submitting, setSubmitting] = useState(false);
  const [hidOk, setHidOk] = useState(true);
  const [holdings, setHoldings] = useState<AssetHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsErr, setHoldingsErr] = useState<string | null>(null);
  const [safeUnplug, setSafeUnplug] = useState(false);
  const [watchingFills, setWatchingFills] = useState(false);
  const [fillNotice, setFillNotice] = useState<{
    trigger: string;
    pyth: string;
    fill: string;
    when: string;
    tx: string;
    compliant: boolean;
  } | null>(null);
  const watchFromTs = useRef<number>(0);
  const sessionRef = useRef<string | null>(null);

  const [form, setForm] = useState<PolicyFormValues>({
    token: BASE_TOKENS.WETH as Address,
    policyType: 0,
    stopLossUsd: "2800",
    takeProfitUsd: "4000",
    maxAmount: "0.0001",
    maxAmountUnit: "eth",
    maxSlippagePercent: "0.5",
  });

  const pushLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => [makeLogEntry(level, message), ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    setHidOk(isWebHidSupported());
  }, []);

  useEffect(() => {
    setLedgerAddress(null);
    setHoldings([]);
    setSafeUnplug(false);
    setFillNotice(null);
  }, [accountIndex]);

  useEffect(() => {
    if (!watchingFills || !ledgerAddress || fillNotice) return;
    const owner = ledgerAddress;
    const tick = async () => {
      try {
        const rows = await fetchOwnerReceipts(owner, watchFromTs.current);
        const hit = rows[0];
        if (!hit) return;
        const triggerRaw = String(hit.triggerType);
        const trigger =
          triggerRaw === "TAKE_PROFIT" || triggerRaw === "1"
            ? "Take-profit"
            : "Stop-loss / buy";
        setFillNotice({
          trigger,
          pyth: usdFrom1e8(hit.pythPrice),
          fill: usdFrom1e8(hit.executionPrice),
          when: new Date(Number(hit.timestamp) * 1000).toLocaleString(),
          tx: hit.txHash.startsWith("0x") ? hit.txHash : `0x${hit.txHash}`,
          compliant: hit.compliant,
        });
        setWatchingFills(false);
        pushLog(
          "success",
          `Fill done — ${trigger} @ Pyth ${usdFrom1e8(hit.pythPrice)}. https://basescan.org/tx/${hit.txHash}`,
        );
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("LGA fill done", {
            body: `${trigger} · Pyth ${usdFrom1e8(hit.pythPrice)} · ${new Date(Number(hit.timestamp) * 1000).toLocaleTimeString()}`,
          });
        }
      } catch (e) {
        console.log("[lga] fill watch", e);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 12_000);
    return () => clearInterval(id);
  }, [watchingFills, ledgerAddress, fillNotice, pushLog]);

  const ethHolding = holdings.find((h) => h.id === "eth");
  const needsGas =
    !!ledgerAddress &&
    holdings.length > 0 &&
    !holdingsLoading &&
    (ethHolding?.balance ?? 0n) === 0n;

  useEffect(() => {
    if (!isWebHidSupported()) return;
    const onDisconnect = () => {
      sessionRef.current = null;
      setConn({ status: "disconnected" });
      pushLog("warn", "HID device unplugged.");
    };
    navigator.hid.addEventListener("disconnect", onDisconnect);
    return () => navigator.hid.removeEventListener("disconnect", onDisconnect);
  }, [pushLog]);

  const loadHoldings = useCallback(
    async (addr: Address) => {
      setHoldingsLoading(true);
      setHoldingsErr(null);
      try {
        const rows = await fetchHoldings(addr);
        setHoldings(rows);
      } catch (e) {
        setHoldingsErr(e instanceof Error ? e.message : String(e));
      } finally {
        setHoldingsLoading(false);
      }
    },
    [],
  );

  const handleConnect = useCallback(async () => {
    if (!isWebHidSupported()) {
      pushLog("error", "WebHID needs Chrome or Edge on desktop.");
      return;
    }
    setConn({ status: "connecting" });
    pushLog("info", "Opening WebHID picker — unlock Ledger, open Ethereum app.");
    try {
      const sessionId = await connectLedger();
      sessionRef.current = sessionId;
      setConn({ status: "connected", sessionId });
      pushLog("success", "Ledger connected.");
    } catch (err) {
      sessionRef.current = null;
      setConn({ status: "disconnected" });
      pushLog("error", err instanceof Error ? err.message : String(err));
    }
  }, [pushLog]);

  const handleDisconnect = useCallback(async () => {
    if (sessionRef.current) await disconnectLedger(sessionRef.current);
    sessionRef.current = null;
    setConn({ status: "disconnected" });
    setLedgerAddress(null);
    setHoldings([]);
    pushLog("info", "Disconnected.");
  }, [pushLog]);

  const ensureAddress = useCallback(async () => {
    if (conn.status !== "connected") throw new Error("Connect Ledger first");
    if (ledgerAddress) return ledgerAddress;
    pushLog("info", `Reading Account ${accountIndex + 1} on Ledger…`);
    const addr = await getLedgerEthAddress(conn.sessionId, accountIndex);
    setLedgerAddress(addr);
    pushLog("success", `Account ${accountIndex + 1}: ${addr}`);
    return addr;
  }, [conn, ledgerAddress, accountIndex, pushLog]);

  const readAddressAndBalances = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    setHoldingsLoading(true);
    setHoldingsErr(null);
    try {
      const addr = await ensureAddress();
      pushLog("info", "Fetching Base balances…");
      const rows = await fetchHoldings(addr);
      setHoldings(rows);
      pushLog(
        "success",
        `Balances loaded — ETH ${rows.find((r) => r.id === "eth")?.balanceFormatted ?? "?"} · WETH ${rows.find((r) => r.id === "weth")?.balanceFormatted ?? "?"}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHoldingsErr(msg);
      pushLog("error", `Read address/balances failed: ${msg}`);
    } finally {
      setHoldingsLoading(false);
    }
  }, [conn, ensureAddress, pushLog]);

  const protectAsset = useCallback((h: AssetHolding) => {
    const isBtc = h.policyToken.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase();
    const isEthFamily =
      h.policyToken.toLowerCase() === BASE_TOKENS.WETH.toLowerCase() ||
      h.id === "eth";
    const spot = h.spotUsd;
    let maxAmount = "0.0001";
    if (h.id === "eth") {
      const n = Math.max(0, Number(h.balanceFormatted) - 0.00008);
      maxAmount = n > 0 ? Math.min(n, 0.0002).toFixed(6) : "0.00005";
    } else if (h.balance > 0n) {
      maxAmount = h.balanceFormatted;
    } else if (isBtc) {
      maxAmount = "0.001";
    }
    setTab("policy");
    setForm((f) => ({
      ...f,
      token: h.policyToken,
      policyType: 0,
      maxAmountUnit: isBtc ? "token" : isEthFamily ? "eth" : "token",
      maxAmount,
      stopLossUsd:
        spot != null ? suggestStopFromSpot(spot, 5) : isBtc ? "90000" : f.stopLossUsd,
      takeProfitUsd:
        spot != null
          ? (spot * 1.1).toFixed(spot > 1000 ? 0 : 2)
          : isBtc
            ? "120000"
            : f.takeProfitUsd,
    }));
    pushLog(
      "info",
      `Filled policy for ${h.symbol}${spot != null ? ` @ $${spot.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""} · max ${maxAmount}`,
    );
  }, [pushLog]);

  const applyInstantFill = useCallback(() => {
    const spot = holdings.find((h) => h.id === "eth" || h.id === "weth")?.spotUsd ?? null;
    const ethH = holdings.find((h) => h.id === "eth");
    const wethH = holdings.find((h) => h.id === "weth");
    const ethBal = ethH ? Number(ethH.balanceFormatted) : 0;
    const wethBal = wethH ? Number(wethH.balanceFormatted) : 0;
    // leave ~0.00008 ETH for gas; use rest of liquid ETH+WETH, min dust
    const room = Math.max(0, ethBal - 0.00008) + wethBal;
    const maxAmount =
      room >= 0.00005 ? Math.min(room, 0.0002).toFixed(6) : "0.00005";
    const d = instantTriggerDefaults(spot);
    setTab("policy");
    setForm((f) => ({
      ...f,
      token: BASE_TOKENS.WETH as Address,
      policyType: 0,
      maxAmountUnit: "eth",
      maxAmount,
      stopLossUsd: d.stopLossUsd,
      takeProfitUsd: d.takeProfitUsd,
      maxSlippagePercent: "1",
    }));
    pushLog(
      "info",
      `Instant-fill preset: stop $${d.stopLossUsd} · max ${maxAmount} ETH (capped to wallet)`,
    );
  }, [holdings, pushLog]);

  const runPrep = useCallback(
    async () => {
      if (conn.status !== "connected") {
        pushLog("warn", "Connect Ledger first.");
        return;
      }
      setSubmitting(true);
      try {
        const from = await ensureAddress();
        const result = await enableKeeperSession(
          conn.sessionId,
          from,
          (e) => pushLog(e.level, e.message),
          accountIndex,
        );
        if (result.status === "success") {
          pushLog("success", `session done — ${result.txHash}`);
          void loadHoldings(from);
        } else if (result.status === "rejected") {
          pushLog("warn", "session rejected on device.");
        } else {
          pushLog("error", result.message);
        }
      } catch (err) {
        pushLog("error", err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [conn, ensureAddress, accountIndex, pushLog, loadHoldings],
  );

  const submitPolicy = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    setSubmitting(true);
    try {
      const from = await ensureAddress();
      const result = await signAndSendSetGuardianPolicy(
        conn.sessionId,
        contractAddress as Address,
        from,
        form,
        (e) => pushLog(e.level, e.message),
        accountIndex,
      );
      if (result.status === "success") {
        pushLog("success", `Policy on-chain — https://basescan.org/tx/${result.txHash}`);
        pushLog(
          "success",
          "Safe to disconnect / unplug Ledger — policy is on-chain; keeper can fill without the device.",
        );
        setSafeUnplug(true);
        watchFromTs.current = Math.floor(Date.now() / 1000) - 30;
        setFillNotice(null);
        setWatchingFills(true);
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          void Notification.requestPermission();
        }
        void loadHoldings(from);
      } else if (result.status === "rejected") {
        pushLog("warn", "Policy rejected on device.");
      } else {
        pushLog("error", result.message);
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [conn, contractAddress, form, accountIndex, ensureAddress, pushLog, loadHoldings]);

  const applyBuyDip = useCallback(async () => {
    setSubmitting(true);
    try {
      const band = await fetchPythBand("eth");
      const usdcH = holdings.find((h) => h.id === "usdc");
      const usdcBal = usdcH ? Number(usdcH.balanceFormatted) : 0;
      const spend =
        usdcBal >= 1 ? Math.min(usdcBal, 5).toFixed(2) : usdcBal > 0 ? usdcBal.toFixed(4) : "1";
      setTab("policy");
      setForm((f) => ({
        ...f,
        token: BASE_TOKENS.WETH as Address,
        policyType: 3,
        maxAmountUnit: "usdc",
        maxAmount: spend,
        // Instant demo: buy when ETH ≤ spot+$1 (already in range)
        stopLossUsd: Number(band.takeProfitUsd).toFixed(2),
        takeProfitUsd: "0",
        maxSlippagePercent: "1",
      }));
      pushLog(
        "info",
        `Buy-dip preset: spend $${spend} USDC → WETH when ETH ≤ $${Number(band.takeProfitUsd).toFixed(2)} (spot $${band.usd.toFixed(2)} — in range for demo).`,
      );
    } catch (e) {
      pushLog("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [holdings, pushLog]);

  const applyPythBand = useCallback(async () => {
    setSubmitting(true);
    try {
      const band = await fetchPythBand("eth");
      const ethH = holdings.find((h) => h.id === "eth");
      const wethH = holdings.find((h) => h.id === "weth");
      const ethBal = ethH ? Number(ethH.balanceFormatted) : 0;
      const wethBal = wethH ? Number(wethH.balanceFormatted) : 0;
      const room = Math.max(0, ethBal - 0.00008) + wethBal;
      const maxAmount =
        room >= 0.00005 ? Math.min(room, 0.0002).toFixed(6) : "0.00005";
      setTab("policy");
      setForm((f) => ({
        ...f,
        token: BASE_TOKENS.WETH as Address,
        policyType: 0 as const,
        maxAmountUnit: "eth",
        maxAmount,
        stopLossUsd: Number(band.stopLossUsd).toFixed(2),
        takeProfitUsd: Number(band.takeProfitUsd).toFixed(2),
        maxSlippagePercent: "1",
      }));
      pushLog(
        "info",
        `Pyth ±$1 (${band.source}): spot $${band.usd.toFixed(2)} → stop $${Number(band.stopLossUsd).toFixed(2)} (−$1) / take $${Number(band.takeProfitUsd).toFixed(2)} (+$1).${band.warning ? ` ${band.warning}` : ""}`,
      );
    } catch (e) {
      pushLog("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [holdings, pushLog]);

  const submitKill = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    setSubmitting(true);
    try {
      const from = await ensureAddress();
      const result = await signAndSendKillSwitch(
        conn.sessionId,
        contractAddress as Address,
        from,
        (e) => pushLog(e.level, e.message),
        accountIndex,
      );
      if (result.status === "success") {
        pushLog("success", `Kill on-chain — https://basescan.org/tx/${result.txHash}`);
      } else if (result.status === "rejected") {
        pushLog("warn", "Kill rejected on device.");
      } else {
        pushLog("error", result.message);
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [conn, contractAddress, accountIndex, ensureAddress, pushLog]);

  const connected = conn.status === "connected";
  const oledRows = formatOledPreviewRows(form);

  return (
    <section className="mt-16 border-t border-line pt-14">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">Ledger</p>
      <h2 className="mt-3 font-display text-2xl text-paper md:text-3xl">
        Clear-sign on device
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-mute">
        Step 1 shows full policy details on the OLED. Step 2 signs the Base tx.
        Master key never leaves Ledger.
      </p>

      {!hidOk && (
        <p className="mt-6 rounded-lg border border-kill/40 bg-kill/10 px-4 py-3 text-sm text-kill">
          WebHID unavailable — use Chrome/Edge on desktop with a USB Ledger.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {conn.status === "disconnected" || conn.status === "connecting" ? (
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={conn.status === "connecting" || !hidOk}
            className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {conn.status === "connecting" ? "Connecting…" : "Connect Ledger"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            className="rounded-full border border-mist px-5 py-2.5 text-sm text-paper hover:border-paper"
          >
            Disconnect
          </button>
        )}
        <span className={`font-mono text-xs ${connected ? "text-signal" : "text-mute"}`}>
          {connected ? "CONNECTED" : conn.status === "connecting" ? "…" : "DISCONNECTED"}
        </span>
        <select
          className={`${field} !mt-0 w-auto min-w-[10rem]`}
          value={accountIndex}
          onChange={(e) => setAccountIndex(Number(e.target.value))}
        >
          {ACCOUNTS.map((a) => (
            <option key={a.index} value={a.index}>
              {a.label}
            </option>
          ))}
        </select>
          <button
            type="button"
            disabled={!connected || holdingsLoading}
            onClick={() => void readAddressAndBalances()}
            className="rounded-full border border-mist px-4 py-2 text-sm text-paper disabled:opacity-40"
          >
            {holdingsLoading ? "Loading…" : "Read address + balances"}
          </button>
          {ledgerAddress && (
            <button
              type="button"
              disabled={holdingsLoading}
              onClick={() => void loadHoldings(ledgerAddress)}
              className="rounded-full border border-mist px-4 py-2 text-sm text-mute hover:text-paper disabled:opacity-40"
            >
              Refresh balances
            </button>
          )}
        {ledgerAddress && (
          <span className="font-mono text-xs text-mute">{ledgerAddress}</span>
        )}
      </div>

      {needsGas && ledgerAddress && <FundGasQr address={ledgerAddress} />}

      {safeUnplug && (
        <div className="mt-4 rounded-xl border border-signal/40 bg-signal/10 p-4">
          <p className="font-display text-lg text-signal">Safe to remove Ledger</p>
          <p className="mt-1 text-sm text-mute">
            Policy is on-chain. Unplug or lock the device — the keeper does not need USB
            to evaluate or fill. We&apos;re watching Receipt Graph for a swap.
          </p>
          {watchingFills && !fillNotice && (
            <p className="mt-2 font-mono text-xs text-mute">
              Waiting for fill… keeper autopolls every ~30s when in band.
              External agents still pay x402 via <code className="text-paper">npm run pay</code>.
            </p>
          )}
        </div>
      )}

      {fillNotice && (
        <div className="mt-4 rounded-xl border border-signal/50 bg-panel p-4">
          <p className="font-display text-lg text-paper">Swap done</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-mute">Trigger</dt>
              <dd className="text-paper">{fillNotice.trigger}</dd>
            </div>
            <div>
              <dt className="text-mute">When</dt>
              <dd className="font-mono text-paper">{fillNotice.when}</dd>
            </div>
            <div>
              <dt className="text-mute">Pyth</dt>
              <dd className="font-mono text-paper">{fillNotice.pyth}</dd>
            </div>
            <div>
              <dt className="text-mute">Fill price</dt>
              <dd className="font-mono text-paper">{fillNotice.fill}</dd>
            </div>
            <div>
              <dt className="text-mute">Compliant</dt>
              <dd className={fillNotice.compliant ? "text-signal" : "text-kill"}>
                {fillNotice.compliant ? "yes" : "no"}
              </dd>
            </div>
            <div>
              <dt className="text-mute">Basescan</dt>
              <dd>
                <a
                  href={`https://basescan.org/tx/${fillNotice.tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-signal hover:underline"
                >
                  {fillNotice.tx.slice(0, 10)}…{fillNotice.tx.slice(-6)}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {(holdings.length > 0 || holdingsLoading || holdingsErr) && (
        <div className="mt-10">
          <h3 className="font-display text-xl text-paper">Account assets</h3>
          <p className="mt-1 text-sm text-mute">
            Live <strong className="text-paper">Pyth</strong> spots (same feed as ±$1 band
            and on-chain fills).
          </p>
          {holdingsErr && (
            <p className="mt-3 text-sm text-kill">{holdingsErr}</p>
          )}
          {holdingsLoading && (
            <p className="mt-3 font-mono text-xs text-mute">Loading balances…</p>
          )}
          <div className="mt-4 overflow-x-auto border-t border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="font-mono text-xs uppercase tracking-wider text-mute">
                  <th className="py-3 pr-4 font-medium">Asset</th>
                  <th className="py-3 pr-4 font-medium">Balance</th>
                  <th className="py-3 pr-4 font-medium">Pyth</th>
                  <th className="py-3 pr-4 font-medium">Value</th>
                  <th className="py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.id} className="border-t border-line/80">
                    <td className="py-3 pr-4">
                      <span className="text-paper">{h.symbol}</span>
                      <span className="ml-2 text-xs text-mute">{h.name}</span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-mute">
                      {Number(h.balanceFormatted).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </td>
                    <td className="py-3 pr-4 font-mono text-mute">
                      {h.spotUsd != null ? `$${h.spotUsd.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-mute">
                      {h.valueUsd != null && h.valueUsd > 0
                        ? `$${h.valueUsd.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => protectAsset(h)}
                        disabled={h.id === "usdc"}
                        className="rounded-full border border-mist px-3 py-1 text-xs text-signal hover:border-signal disabled:opacity-30"
                      >
                        Protect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ledgerAddress && (
        <div className="mt-10 rounded-xl border border-line bg-panel p-4">
          <h3 className="font-display text-lg text-paper">Fast fill prep</h3>
          <p className="mt-1 text-sm text-mute">
            Pick ETH — we <strong className="text-paper">auto-wrap</strong> to WETH
            during clear-sign (and approve GPM if needed). Ledger Live will show{" "}
            <strong className="text-paper">WETH</strong> until the exit fills to USDC.
            Still enable the keeper session key once.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-mute">
            <li>Enable keeper session key (once)</li>
            <li>Instant-fill preset (or set your own stop)</li>
            <li>
              Clear-sign — OLED may ask wrap → approve → policy
            </li>
            <li>
              Run keeper <code className="text-paper">npm run pay</code>
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!connected || submitting}
              onClick={() => void runPrep()}
              className="rounded-full border border-mist px-4 py-2 text-sm text-paper disabled:opacity-40"
            >
              Enable keeper
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void applyBuyDip()}
              className="rounded-full border border-signal/50 px-4 py-2 text-sm text-signal disabled:opacity-40"
            >
              Buy dip (USDC → ETH)
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void applyPythBand()}
              className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
            >
              Pyth ±$1 (stop −1 / take +1)
            </button>
            <button
              type="button"
              onClick={applyInstantFill}
              className="rounded-full border border-mist px-4 py-2 text-sm text-paper"
            >
              Instant-fill (stop above spot)
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-2">
        {(["policy", "kill"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === t
                ? t === "kill"
                  ? "bg-kill text-ink"
                  : "bg-paper text-ink"
                : "border border-mist text-mute hover:text-paper"
            }`}
          >
            {t === "policy" ? "Set policy" : "Kill switch"}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <label className={label}>
            GuardianPolicyManager
            <input
              className={field}
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value.trim())}
            />
          </label>

          {tab === "policy" ? (
            <>
              <label className={label}>
                Protected token
                <select
                  className={field}
                  value={form.token}
                  onChange={(e) => {
                    const token = e.target.value as Address;
                    const isBtc =
                      token.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase();
                    setForm((f) => ({
                      ...f,
                      token,
                      maxAmountUnit: isBtc ? "token" : "eth",
                      maxAmount: isBtc ? "0.001" : f.maxAmount,
                      stopLossUsd: isBtc ? "90000" : f.stopLossUsd,
                      takeProfitUsd: isBtc ? "120000" : f.takeProfitUsd,
                    }));
                  }}
                >
                  <option value={BASE_TOKENS.WETH}>ETH (WETH)</option>
                  <option value={BASE_TOKENS.CBBTC}>BTC (cbBTC)</option>
                  <option value={BASE_TOKENS.USDC}>USDC</option>
                  <option value={BASE_TOKENS.cbETH}>cbETH</option>
                </select>
              </label>

              <label className={label}>
                Policy type
                <select
                  className={field}
                  value={String(form.policyType)}
                  onChange={(e) => {
                    const policyType = Number(e.target.value) as 0 | 1 | 2 | 3;
                    setForm((f) => ({
                      ...f,
                      policyType,
                      ...(policyType === 3
                        ? {
                            token: BASE_TOKENS.WETH as Address,
                            maxAmountUnit: "usdc" as const,
                            maxAmount: f.maxAmountUnit === "usdc" ? f.maxAmount : "1",
                          }
                        : f.policyType === 3
                          ? { maxAmountUnit: "eth" as const, maxAmount: "0.0001" }
                          : {}),
                    }));
                  }}
                >
                  <option value="0">Stop-loss (sell)</option>
                  <option value="1">Take-profit (sell)</option>
                  <option value="2">LP stop-loss (sell)</option>
                  <option value="3">Buy-dip (USDC → ETH)</option>
                </select>
              </label>

              {(form.policyType === 0 ||
                form.policyType === 2 ||
                form.policyType === 3) && (
                <label className={label}>
                  {form.policyType === 3 ? "Buy if ETH ≤ (USD)" : "Stop-loss (USD)"}
                  <input
                    className={field}
                    value={form.stopLossUsd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stopLossUsd: e.target.value }))
                    }
                  />
                </label>
              )}

              {(form.policyType === 1 ||
                form.policyType === 2 ||
                form.policyType === 3 ||
                (form.policyType === 0 && Number(form.takeProfitUsd) > 0)) && (
                <label className={label}>
                  {form.policyType === 3 ? "Buy if ETH ≥ (USD)" : "Take-profit (USD)"}
                  <input
                    className={field}
                    value={form.takeProfitUsd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, takeProfitUsd: e.target.value }))
                    }
                  />
                </label>
              )}

              <label className={label}>
                Max amount
                <div className="mt-1.5 flex min-w-0 items-stretch gap-2">
                  <input
                    className={`${field} !mt-0 min-w-0 flex-1 !w-auto`}
                    value={form.maxAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxAmount: e.target.value }))
                    }
                  />
                  <select
                    className={`${field} !mt-0 !w-28 shrink-0`}
                    value={form.maxAmountUnit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxAmountUnit: e.target.value as "eth" | "token" | "usdc",
                      }))
                    }
                  >
                    {form.policyType === 3 ? (
                      <option value="usdc">USDC</option>
                    ) : (
                      <>
                        <option value="eth">ETH</option>
                        <option value="token">
                          {form.token.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase()
                            ? "BTC"
                            : "Token"}
                        </option>
                      </>
                    )}
                  </select>
                </div>
              </label>

              <label className={label}>
                Max slippage (%)
                <input
                  className={field}
                  value={form.maxSlippagePercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxSlippagePercent: e.target.value }))
                  }
                />
              </label>

              <button
                type="button"
                disabled={!connected || submitting}
                onClick={() => void submitPolicy()}
                className="mt-2 rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
              >
                {submitting
                  ? "Waiting on Ledger…"
                  : form.policyType === 3
                    ? "Clear-sign buy-dip (approve USDC)"
                    : "Clear-sign policy (auto-wrap ETH)"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-mute">
                OLED first shows the kill intent, then you approve the on-chain
                killSwitch() tx.
              </p>
              <button
                type="button"
                disabled={!connected || submitting}
                onClick={() => void submitKill()}
                className="rounded-full bg-kill px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
              >
                {submitting ? "Waiting on Ledger…" : "Clear-sign kill switch"}
              </button>
            </>
          )}
        </div>

        <div className="space-y-4">
          {tab === "policy" && (
            <div className="rounded-xl border border-signal/30 bg-panel p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-signal">
                OLED preview · step 1
              </p>
              <p className="mt-2 text-xs text-mute">
                This text is what you scroll on the device before the tx.
              </p>
              <dl className="mt-4 space-y-2">
                {oledRows.map((r) => (
                  <div
                    key={r.label}
                    className="flex justify-between gap-4 border-b border-line/60 pb-2 text-sm"
                  >
                    <dt className="text-mute">{r.label}</dt>
                    <dd className="text-right font-mono text-paper">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="rounded-xl border border-line bg-panel p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-mute">Device log</p>
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto font-mono text-xs">
              {logs.length === 0 && (
                <li className="text-mute">Connect Ledger to start.</li>
              )}
              {logs.map((l) => (
                <li
                  key={l.id}
                  className={
                    l.level === "error"
                      ? "text-kill"
                      : l.level === "success"
                        ? "text-signal"
                        : l.level === "warn"
                          ? "text-amber-400"
                          : "text-mute"
                  }
                >
                  <span className="opacity-60">{l.ts}</span> {l.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
