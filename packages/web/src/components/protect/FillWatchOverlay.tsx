"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FillCongratsModal } from "@/components/protect/FillCongratsModal";
import { useProtectionOptional } from "@/components/ProtectionProvider";
import { receiptToFillNotice, type FillNotice } from "@/lib/fillNotice";
import { fetchOwnerReceipts } from "@/lib/fillWatch";
import { fetchOnchainOwnerFills } from "@/lib/onchainActivity";

const WATCH_KEY = "lga.fillWatch.v1";

type WatchBag = {
  owner: string;
  fromTs: number;
  fromBlock: number;
  active: boolean;
};

function loadWatch(): WatchBag | null {
  try {
    const raw = sessionStorage.getItem(WATCH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WatchBag;
  } catch {
    return null;
  }
}

function saveWatch(v: WatchBag | null) {
  try {
    if (!v) sessionStorage.removeItem(WATCH_KEY);
    else sessionStorage.setItem(WATCH_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

async function tipBlock(): Promise<number> {
  const rpc =
    process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
    cache: "no-store",
  });
  const j = (await res.json()) as { result?: string };
  return j.result ? Number.parseInt(j.result, 16) : 0;
}

/** Site-wide fill watch + congrats — Graph first, Base logs fallback. */
export function FillWatchOverlay() {
  const protection = useProtectionOptional();
  const [notice, setNotice] = useState<FillNotice | null>(null);
  const [open, setOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const fromTs = useRef(0);
  const fromBlock = useRef(0);
  const ownerRef = useRef<string | null>(null);
  const seenTx = useRef<string | null>(null);

  const arm = useCallback(async (owner: string, from: number) => {
    const tip = await tipBlock().catch(() => 0);
    ownerRef.current = owner.toLowerCase();
    fromTs.current = from;
    fromBlock.current = Math.max(0, tip - 2);
    seenTx.current = null;
    setNotice(null);
    setOpen(false);
    setWatching(true);
    saveWatch({
      owner: owner.toLowerCase(),
      fromTs: from,
      fromBlock: fromBlock.current,
      active: true,
    });
  }, []);

  useEffect(() => {
    const w = loadWatch();
    if (!w?.active || !w.owner) return;
    ownerRef.current = w.owner;
    fromTs.current = w.fromTs;
    fromBlock.current = w.fromBlock ?? 0;
    setWatching(true);
  }, []);

  useEffect(() => {
    if (!protection?.fillWatchNonce) return;
    const req = protection.fillWatchRequest;
    if (!req) return;
    void arm(req.owner, req.fromTs);
  }, [protection?.fillWatchNonce, protection?.fillWatchRequest, arm]);

  useEffect(() => {
    const replay = protection?.fillCongratsReplay;
    if (!replay?.notice) return;
    setNotice(replay.notice);
    setOpen(true);
  }, [protection?.fillCongratsReplay]);

  useEffect(() => {
    if (!watching || !ownerRef.current) return;
    const owner = ownerRef.current;

    const apply = (n: FillNotice) => {
      if (seenTx.current === n.tx) return;
      seenTx.current = n.tx;
      setNotice(n);
      setOpen(true);
      setWatching(false);
      saveWatch(null);
      protection?.setStage("outcome");
    };

    const tick = async () => {
      try {
        const rows = await fetchOwnerReceipts(owner, fromTs.current);
        const hit = rows[0];
        if (hit) {
          apply(receiptToFillNotice(hit));
          return;
        }
      } catch (e) {
        console.log("[lga] fill watch graph", e);
      }

      try {
        const onchain = await fetchOnchainOwnerFills({ owner });
        const hit = onchain.find((r) => r.blockNumber >= fromBlock.current);
        if (!hit) return;
        apply(
          receiptToFillNotice({
            ...hit,
            timestamp: Math.floor(Date.now() / 1000),
          }),
        );
      } catch (e) {
        console.log("[lga] fill watch onchain", e);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), 4_000);
    return () => clearInterval(id);
  }, [watching, protection]);

  if (!open || !notice) return null;
  return (
    <FillCongratsModal notice={notice} onClose={() => setOpen(false)} />
  );
}
