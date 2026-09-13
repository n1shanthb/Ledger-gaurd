"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
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
  chartAssetForToken,
  formDefaultsForType,
} from "@/lib/policyDefaults";
import {
  signAndSendSetGuardianPolicy,
  type PolicyFormValues,
} from "@/lib/policyTx";
import {
  useProtection,
  type JourneyStage,
  type ProductMode,
} from "@/components/ProtectionProvider";

export const ACCOUNTS = [
  { index: 0, label: "Account 1" },
  { index: 1, label: "Account 2 (test)" },
  { index: 2, label: "Account 3" },
  { index: 3, label: "Account 4" },
];

export type FillNotice = {
  trigger: string;
  pyth: string;
  fill: string;
  when: string;
  tx: string;
  compliant: boolean;
};

export type JourneyPhase =
  | "idle"
  | "connecting"
  | "signing"
  | "session"
  | "kill";

const keeperBase =
  process.env.NEXT_PUBLIC_KEEPER_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:3001";

export function useProtectJourney() {
  const protection = useProtection();
  const {
    mode,
    setMode,
    accountIndex,
    setAccountIndex,
    ledgerAddress,
    setLedgerAddress,
    setConnected,
    stage,
    setStage,
    sessionEnabled,
    setSessionEnabled,
    setKillConfirmed,
    setLastPolicyTx,
    setLastKillTx,
    lastKillTx,
    killConfirmed,
  } = protection;

  const [conn, setConn] = useState<ConnectionState>({ status: "disconnected" });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [contractAddress, setContractAddress] = useState<string>(GPM_V2);
  const [phase, setPhase] = useState<JourneyPhase>("idle");
  const [hidOk, setHidOk] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);
  const [holdings, setHoldings] = useState<AssetHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsErr, setHoldingsErr] = useState<string | null>(null);
  const [safeUnplug, setSafeUnplug] = useState(false);
  const [watchingFills, setWatchingFills] = useState(false);
  const [fillNotice, setFillNotice] = useState<FillNotice | null>(null);
  const [limitsAck, setLimitsAck] = useState(false);
  const [killAck, setKillAck] = useState(false);
  const [keeperHealth, setKeeperHealth] = useState<string | null>(null);
  const [paidAttemptMsg, setPaidAttemptMsg] = useState<string | null>(null);
  const [paidAttemptBusy, setPaidAttemptBusy] = useState(false);
  const watchFromTs = useRef(0);
  const sessionRef = useRef<string | null>(null);

  const [form, setForm] = useState<PolicyFormValues>({
    token: BASE_TOKENS.WETH as Address,
    policyType: 0,
    stopLossUsd: "2800",
    takeProfitUsd: "0",
    maxAmount: "0.0001",
    maxAmountUnit: "eth",
    maxSlippagePercent: "0.5",
  });

  const pushLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => [makeLogEntry(level, message), ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    setHidOk(isWebHidSupported());
    setIsDesktop(
      typeof window !== "undefined" &&
        window.matchMedia("(min-width: 768px)").matches &&
        !/Mobi|Android/i.test(navigator.userAgent),
    );
  }, []);

  useEffect(() => {
    setConnected(conn.status === "connected");
  }, [conn.status, setConnected]);

  useEffect(() => {
    setLedgerAddress(null);
    setHoldings([]);
    setSafeUnplug(false);
    setFillNotice(null);
  }, [accountIndex, setLedgerAddress]);

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
        setStage("outcome");
        pushLog(
          "success",
          `Fill done — ${trigger} @ Pyth ${usdFrom1e8(hit.pythPrice)}.`,
        );
      } catch (e) {
        console.log("[lga] fill watch", e);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 12_000);
    return () => clearInterval(id);
  }, [watchingFills, ledgerAddress, fillNotice, pushLog, setStage]);

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

  const refreshKeeper = useCallback(async () => {
    try {
      const res = await fetch(`${keeperBase}/health`, { cache: "no-store" });
      const j = (await res.json()) as {
        poll?: { mode?: string };
        openRouter?: boolean;
      };
      setKeeperHealth(
        `${j.poll?.mode ?? "ok"} · openRouter=${j.openRouter ? "yes" : "no"}`,
      );
    } catch {
      setKeeperHealth(null);
    }
  }, []);

  useEffect(() => {
    void refreshKeeper();
    const id = setInterval(() => void refreshKeeper(), 20_000);
    return () => clearInterval(id);
  }, [refreshKeeper]);

  const loadHoldings = useCallback(async (addr: Address) => {
    setHoldingsLoading(true);
    setHoldingsErr(null);
    try {
      setHoldings(await fetchHoldings(addr));
    } catch (e) {
      setHoldingsErr(e instanceof Error ? e.message : String(e));
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!isWebHidSupported()) {
      pushLog("error", "WebHID needs Chrome or Edge on desktop.");
      return;
    }
    setPhase("connecting");
    setConn({ status: "connecting" });
    pushLog("info", "Opening WebHID picker — unlock Ledger, open Ethereum app.");
    try {
      const sessionId = await connectLedger();
      sessionRef.current = sessionId;
      setConn({ status: "connected", sessionId });
      pushLog("success", "Ledger connected.");
      setPhase("idle");
    } catch (err) {
      sessionRef.current = null;
      setConn({ status: "disconnected" });
      pushLog("error", err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }, [pushLog]);

  const handleDisconnect = useCallback(async () => {
    if (sessionRef.current) await disconnectLedger(sessionRef.current);
    sessionRef.current = null;
    setConn({ status: "disconnected" });
    setLedgerAddress(null);
    setHoldings([]);
    pushLog("info", "Disconnected.");
  }, [pushLog, setLedgerAddress]);

  const ensureAddress = useCallback(async () => {
    if (conn.status !== "connected") throw new Error("Connect Ledger first");
    if (ledgerAddress) return ledgerAddress;
    pushLog("info", `Reading Account ${accountIndex + 1} on Ledger…`);
    const addr = await getLedgerEthAddress(conn.sessionId, accountIndex);
    setLedgerAddress(addr);
    pushLog("success", `Account ${accountIndex + 1}: ${addr}`);
    return addr;
  }, [conn, ledgerAddress, accountIndex, pushLog, setLedgerAddress]);

  const readAddressAndBalances = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    setHoldingsLoading(true);
    setHoldingsErr(null);
    try {
      const addr = await ensureAddress();
      const rows = await fetchHoldings(addr);
      setHoldings(rows);
      setStage("asset");
      pushLog("success", "Balances loaded.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHoldingsErr(msg);
      pushLog("error", msg);
    } finally {
      setHoldingsLoading(false);
    }
  }, [conn, ensureAddress, pushLog, setStage]);

  const protectAsset = useCallback(
    (h: AssetHolding) => {
      const isBtc =
        h.policyToken.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase();
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
      setForm((f) => ({
        ...f,
        token: h.policyToken,
        policyType: 0,
        maxAmountUnit: isBtc ? "token" : isEthFamily ? "eth" : "token",
        maxAmount,
        stopLossUsd:
          spot != null
            ? suggestStopFromSpot(spot, 5)
            : isBtc
              ? "90000"
              : f.stopLossUsd,
        takeProfitUsd:
          spot != null
            ? (spot * 1.1).toFixed(spot > 1000 ? 0 : 2)
            : isBtc
              ? "120000"
              : f.takeProfitUsd,
      }));
      setStage("strategy");
      setLimitsAck(false);
    },
    [setStage],
  );

  const applyInstantFill = useCallback(() => {
    if (mode === "live") return;
    const spot =
      holdings.find((h) => h.id === "eth" || h.id === "weth")?.spotUsd ?? null;
    const ethH = holdings.find((h) => h.id === "eth");
    const wethH = holdings.find((h) => h.id === "weth");
    const ethBal = ethH ? Number(ethH.balanceFormatted) : 0;
    const wethBal = wethH ? Number(wethH.balanceFormatted) : 0;
    const room = Math.max(0, ethBal - 0.00008) + wethBal;
    const maxAmount =
      room >= 0.00005 ? Math.min(room, 0.0002).toFixed(6) : "0.00005";
    const d = instantTriggerDefaults(spot);
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
    setStage("limits");
    pushLog(
      "info",
      `Demo fill now: stop $${d.stopLossUsd} (above spot${spot != null ? ` $${spot.toFixed(2)}` : ""}) — already in range`,
    );
  }, [holdings, mode, pushLog, setStage]);

  const applyBuyDip = useCallback(async () => {
    if (mode === "live") return;
    setPhase("idle");
    try {
      const band = await fetchPythBand("eth");
      const usdcH = holdings.find((h) => h.id === "usdc");
      const usdcBal =
        usdcH?.balanceOk && usdcH.balance > 0n
          ? Number(usdcH.balance) / 1e6
          : 0;
      const spend =
        usdcBal >= 1
          ? Math.min(usdcBal, 5).toFixed(2)
          : usdcBal > 0
            ? usdcBal.toFixed(4)
            : "1";
      setForm((f) => ({
        ...f,
        token: BASE_TOKENS.WETH as Address,
        policyType: 3,
        maxAmountUnit: "usdc",
        maxAmount: spend,
        stopLossUsd: Number(band.takeProfitUsd).toFixed(2),
        takeProfitUsd: "0",
        maxSlippagePercent: "1",
      }));
      setStage("limits");
      pushLog("info", `Demo buy-dip preset ≤ $${Number(band.takeProfitUsd).toFixed(2)}`);
    } catch (e) {
      pushLog("error", e instanceof Error ? e.message : String(e));
    }
  }, [holdings, mode, pushLog, setStage]);

  const applyNearBandWatch = useCallback(async () => {
    if (mode === "live") return;
    try {
      const band = await fetchPythBand("eth");
      const ethH = holdings.find((h) => h.id === "eth");
      const wethH = holdings.find((h) => h.id === "weth");
      const ethBal = ethH ? Number(ethH.balanceFormatted) : 0;
      const wethBal = wethH ? Number(wethH.balanceFormatted) : 0;
      const room = Math.max(0, ethBal - 0.00008) + wethBal;
      const maxAmount =
        room >= 0.00005 ? Math.min(room, 0.0002).toFixed(6) : "0.00005";
      // Slightly under spot — real wait, but small move; Hermes must cross stop before pay
      const stop = Math.max(1, band.usd - 5).toFixed(2);
      setForm((f) => ({
        ...f,
        token: BASE_TOKENS.WETH as Address,
        policyType: 0,
        maxAmountUnit: "eth",
        maxAmount,
        stopLossUsd: stop,
        takeProfitUsd: "0",
        maxSlippagePercent: "1",
      }));
      setStage("limits");
      pushLog(
        "info",
        `Near-band watch: stop $${stop} (spot $${band.usd.toFixed(2)} − $5). Clear-sign, unplug Ledger, wait for Hermes to cross.`,
      );
    } catch (e) {
      pushLog("error", e instanceof Error ? e.message : String(e));
    }
  }, [holdings, mode, pushLog, setStage]);

  const applyPythBand = useCallback(async () => {
    if (mode === "live") return;
    try {
      const band = await fetchPythBand("eth");
      const ethH = holdings.find((h) => h.id === "eth");
      const wethH = holdings.find((h) => h.id === "weth");
      const ethBal = ethH ? Number(ethH.balanceFormatted) : 0;
      const wethBal = wethH ? Number(wethH.balanceFormatted) : 0;
      const room = Math.max(0, ethBal - 0.00008) + wethBal;
      const maxAmount =
        room >= 0.00005 ? Math.min(room, 0.0002).toFixed(6) : "0.00005";
      // Already-in-range with $10 cushion (not ±$1 under spot — that races VAAs)
      const stop = (band.usd + 10).toFixed(2);
      setForm((f) => ({
        ...f,
        token: BASE_TOKENS.WETH as Address,
        policyType: 0,
        maxAmountUnit: "eth",
        maxAmount,
        stopLossUsd: stop,
        takeProfitUsd: "0",
        maxSlippagePercent: "1",
      }));
      setStage("limits");
      pushLog(
        "info",
        `Demo already-in-range: stop $${stop} (spot $${band.usd.toFixed(2)} + $10 cushion)`,
      );
    } catch (e) {
      pushLog("error", e instanceof Error ? e.message : String(e));
    }
  }, [holdings, mode, pushLog, setStage]);

  const runPrep = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    setPhase("session");
    try {
      const from = await ensureAddress();
      const result = await enableKeeperSession(
        conn.sessionId,
        from,
        (e) => pushLog(e.level, e.message),
        accountIndex,
      );
      if (result.status === "success") {
        setSessionEnabled(true);
        pushLog("success", `Session key enabled — ${result.txHash}`);
        void loadHoldings(from);
      } else if (result.status === "rejected") {
        pushLog("warn", "Session rejected on device.");
      } else {
        pushLog("error", result.message);
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : String(err));
    } finally {
      setPhase("idle");
    }
  }, [
    conn,
    ensureAddress,
    accountIndex,
    pushLog,
    loadHoldings,
    setSessionEnabled,
  ]);

  const submitPolicy = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    if (mode === "live" && !limitsAck) {
      pushLog("warn", "Acknowledge limits before signing in Live mode.");
      return;
    }
    setPhase("signing");
    setStage("signing");
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
        setLastPolicyTx(result.txHash);
        setSafeUnplug(true);
        watchFromTs.current = Math.floor(Date.now() / 1000) - 30;
        setFillNotice(null);
        setWatchingFills(true);
        setStage("monitor");
        pushLog("success", `Policy on-chain — ${result.txHash}`);
        void loadHoldings(from);
      } else if (result.status === "rejected") {
        setStage("review");
        pushLog("warn", "Policy rejected on device.");
      } else {
        setStage("review");
        pushLog("error", result.message);
      }
    } catch (err) {
      setStage("review");
      pushLog("error", err instanceof Error ? err.message : String(err));
    } finally {
      setPhase("idle");
    }
  }, [
    conn,
    contractAddress,
    form,
    accountIndex,
    ensureAddress,
    pushLog,
    loadHoldings,
    mode,
    limitsAck,
    setLastPolicyTx,
    setStage,
  ]);

  const submitKill = useCallback(async () => {
    if (conn.status !== "connected") {
      pushLog("warn", "Connect Ledger first.");
      return;
    }
    if (!killAck) {
      pushLog("warn", "Confirm kill intent first.");
      return;
    }
    setPhase("kill");
    setStage("kill");
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
        setLastKillTx(result.txHash);
        setKillConfirmed(true);
        setWatchingFills(false);
        setSafeUnplug(false);
        setStage("outcome");
        pushLog("success", `Kill on-chain — ${result.txHash}`);
      } else if (result.status === "rejected") {
        pushLog("warn", "Kill rejected on device.");
      } else {
        pushLog("error", result.message);
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : String(err));
    } finally {
      setPhase("idle");
    }
  }, [
    conn,
    contractAddress,
    accountIndex,
    ensureAddress,
    pushLog,
    killAck,
    setLastKillTx,
    setKillConfirmed,
    setStage,
  ]);

  /** Ask Autopilot/Payer path via agent run — does not invent a fill. */
  const runPaidAttempt = useCallback(async () => {
    setPaidAttemptBusy(true);
    setPaidAttemptMsg(null);
    try {
      const res = await fetch(`${keeperBase}/agent/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Run a paid /trigger evaluation now for active policies. Report payment and evaluation only — do not claim a fill unless executed txs are returned.",
            },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`Keeper agent ${res.status}`);
      }
      // Consume SSE lightly for final reply
      const text = await res.text();
      const lines = text.split("\n");
      let reply = "Paid attempt requested. Check Activity for evaluation vs fill.";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim()) as {
            type?: string;
            reply?: string;
          };
          if (ev.type === "run_end" && ev.reply) reply = ev.reply;
        } catch {
          /* skip */
        }
      }
      setPaidAttemptMsg(reply);
      setStage("monitor");
      void refreshKeeper();
    } catch (e) {
      setPaidAttemptMsg(
        e instanceof Error
          ? `Keeper unavailable — ${e.message}. Monitoring paused until keeper is reachable.`
          : "Keeper unavailable.",
      );
    } finally {
      setPaidAttemptBusy(false);
    }
  }, [refreshKeeper, setStage]);

  const startWatching = useCallback(() => {
    watchFromTs.current = Math.floor(Date.now() / 1000) - 30;
    setFillNotice(null);
    setWatchingFills(true);
    setStage("monitor");
    pushLog("info", "Watching Receipt Graph for a fill (not a payment).");
  }, [pushLog, setStage]);

  const setStrategy = useCallback(
    (policyType: 0 | 1 | 2 | 3) => {
      const spot =
        holdings.find((h) =>
          form.token.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase()
            ? h.id === "cbbtc"
            : h.id === "eth" || h.id === "weth",
        )?.spotUsd ?? null;
      setForm((f) => ({ ...f, ...formDefaultsForType(policyType, spot) }));
      setStage("limits");
      setLimitsAck(false);
    },
    [form.token, holdings, setStage],
  );

  const goStage = useCallback(
    (s: JourneyStage) => {
      setStage(s);
    },
    [setStage],
  );

  const connected = conn.status === "connected";
  const oledRows = formatOledPreviewRows(form);
  const busy = phase !== "idle" && phase !== "connecting";
  const readOnlyMobile = !isDesktop || !hidOk;

  return {
    mode,
    setMode: setMode as (m: ProductMode) => void,
    accountIndex,
    setAccountIndex,
    stage,
    goStage,
    conn,
    connected,
    logs,
    ledgerAddress,
    contractAddress,
    setContractAddress,
    phase,
    hidOk,
    isDesktop,
    readOnlyMobile,
    holdings,
    holdingsLoading,
    holdingsErr,
    needsGas,
    safeUnplug,
    watchingFills,
    fillNotice,
    form,
    setForm,
    limitsAck,
    setLimitsAck,
    killAck,
    setKillAck,
    killConfirmed,
    lastKillTx,
    sessionEnabled,
    keeperHealth,
    keeperBase,
    paidAttemptMsg,
    paidAttemptBusy,
    oledRows,
    busy,
    chartAsset: chartAssetForToken(form.token),
    handleConnect,
    handleDisconnect,
    readAddressAndBalances,
    loadHoldings,
    protectAsset,
    applyInstantFill,
    applyBuyDip,
    applyPythBand,
    applyNearBandWatch,
    runPrep,
    submitPolicy,
    submitKill,
    runPaidAttempt,
    startWatching,
    setStrategy,
    pushLog,
  };
}
