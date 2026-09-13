"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Address } from "viem";

export type ProductMode = "demo" | "live";
export type JourneyStage =
  | "device"
  | "asset"
  | "strategy"
  | "limits"
  | "review"
  | "signing"
  | "monitor"
  | "outcome"
  | "kill";

export type ProtectionContextValue = {
  mode: ProductMode;
  setMode: (m: ProductMode) => void;
  accountIndex: number;
  setAccountIndex: (i: number) => void;
  ledgerAddress: Address | null;
  setLedgerAddress: (a: Address | null) => void;
  connected: boolean;
  setConnected: (v: boolean) => void;
  stage: JourneyStage;
  setStage: (s: JourneyStage) => void;
  sessionEnabled: boolean;
  setSessionEnabled: (v: boolean) => void;
  killConfirmed: boolean;
  setKillConfirmed: (v: boolean) => void;
  lastPolicyTx: string | null;
  setLastPolicyTx: (tx: string | null) => void;
  lastKillTx: string | null;
  setLastKillTx: (tx: string | null) => void;
  ownerFilter: Address | null;
};

const ProtectionContext = createContext<ProtectionContextValue | null>(null);

const MODE_KEY = "lga.productMode";
const ACCOUNT_KEY = "lga.accountIndex";
const POLICY_TX_KEY = "lga.lastPolicyTx";
const KILL_TX_KEY = "lga.lastKillTx";
const ADDR_KEY = "lga.ledgerAddress";

export function ProtectionProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ProductMode>("demo");
  const [accountIndex, setAccountIndexState] = useState(1);
  const [ledgerAddress, setLedgerAddressState] = useState<Address | null>(null);
  const [connected, setConnected] = useState(false);
  const [stage, setStage] = useState<JourneyStage>("device");
  const [sessionEnabled, setSessionEnabled] = useState(false);
  const [killConfirmed, setKillConfirmed] = useState(false);
  const [lastPolicyTx, setLastPolicyTxState] = useState<string | null>(null);
  const [lastKillTx, setLastKillTxState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "demo" || m === "live") setModeState(m);
      const a = localStorage.getItem(ACCOUNT_KEY);
      if (a != null && !Number.isNaN(Number(a))) setAccountIndexState(Number(a));
      const tx = localStorage.getItem(POLICY_TX_KEY);
      if (tx?.startsWith("0x")) setLastPolicyTxState(tx);
      const ktx = localStorage.getItem(KILL_TX_KEY);
      if (ktx?.startsWith("0x")) setLastKillTxState(ktx);
      const addr = localStorage.getItem(ADDR_KEY);
      if (addr?.startsWith("0x") && addr.length === 42) {
        setLedgerAddressState(addr as Address);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback((m: ProductMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const setAccountIndex = useCallback((i: number) => {
    setAccountIndexState(i);
    try {
      localStorage.setItem(ACCOUNT_KEY, String(i));
    } catch {
      /* ignore */
    }
  }, []);

  const setLedgerAddress = useCallback((a: Address | null) => {
    setLedgerAddressState(a);
    try {
      if (a) localStorage.setItem(ADDR_KEY, a);
      else localStorage.removeItem(ADDR_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setLastPolicyTx = useCallback((tx: string | null) => {
    setLastPolicyTxState(tx);
    try {
      if (tx) localStorage.setItem(POLICY_TX_KEY, tx);
      else localStorage.removeItem(POLICY_TX_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setLastKillTx = useCallback((tx: string | null) => {
    setLastKillTxState(tx);
    try {
      if (tx) localStorage.setItem(KILL_TX_KEY, tx);
      else localStorage.removeItem(KILL_TX_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ProtectionContextValue>(
    () => ({
      mode,
      setMode,
      accountIndex,
      setAccountIndex,
      ledgerAddress,
      setLedgerAddress,
      connected,
      setConnected,
      stage,
      setStage,
      sessionEnabled,
      setSessionEnabled,
      killConfirmed,
      setKillConfirmed,
      lastPolicyTx,
      setLastPolicyTx,
      lastKillTx,
      setLastKillTx,
      ownerFilter: ledgerAddress,
    }),
    [
      mode,
      setMode,
      accountIndex,
      setAccountIndex,
      ledgerAddress,
      setLedgerAddress,
      connected,
      stage,
      sessionEnabled,
      killConfirmed,
      lastPolicyTx,
      setLastPolicyTx,
      lastKillTx,
      setLastKillTx,
    ],
  );

  return (
    <ProtectionContext.Provider value={value}>
      {children}
    </ProtectionContext.Provider>
  );
}

export function useProtection() {
  const ctx = useContext(ProtectionContext);
  if (!ctx) {
    throw new Error("useProtection must be used within ProtectionProvider");
  }
  return ctx;
}

export function useProtectionOptional() {
  return useContext(ProtectionContext);
}
