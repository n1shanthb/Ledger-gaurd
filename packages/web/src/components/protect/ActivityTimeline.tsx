"use client";

import { useEffect, useMemo, useState } from "react";
import { useProtection } from "@/components/ProtectionProvider";
import { EmptyState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { STUDIO_URL, SUBGRAPH_QUERY_URL, usdFrom1e8 } from "@/lib/constants";
import {
  fetchRecentPolicyCreated,
  fetchStudioMeta,
  type OnchainPolicyCreated,
} from "@/lib/onchainActivity";
import type { KillRow, PolicyRow, ReceiptRow } from "@/lib/subgraph";

function policyTypeLabel(t: string | number): string {
  const s = String(t);
  if (s === "1" || s === "TAKE_PROFIT" || t === 1) return "Take-profit";
  if (s === "2" || s === "LP_STOP_LOSS" || t === 2) return "LP stop-loss";
  if (s === "3" || s === "BUY_DIP" || t === 3) return "Buy-dip";
  return "Stop-loss";
}

type Item =
  | { kind: "fill"; id: string; ts: number; receipt: ReceiptRow }
  | { kind: "kill"; id: string; ts: number; kill: KillRow }
  | { kind: "policy"; id: string; ts: number; policy: PolicyRow }
  | { kind: "pending"; id: string; ts: number; onchain: OnchainPolicyCreated };

export function ActivityTimeline({
  receipts,
  kills,
  policies,
  error,
}: {
  receipts: ReceiptRow[];
  kills: KillRow[];
  policies: PolicyRow[];
  error: string | null;
}) {
  const { ownerFilter, lastPolicyTx } = useProtection();
  const [onchain, setOnchain] = useState<OnchainPolicyCreated[]>([]);
  const [studioBlock, setStudioBlock] = useState<number | null>(null);
  const [baseTip, setBaseTip] = useState<number | null>(null);
  const [chainErr, setChainErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      try {
        const [rows, meta] = await Promise.all([
          fetchRecentPolicyCreated({
            owner: ownerFilter,
            lookbackBlocks: 12_000,
          }),
          fetchStudioMeta(SUBGRAPH_QUERY_URL),
        ]);
        if (dead) return;
        setOnchain(rows);
        setStudioBlock(meta?.blockNumber ?? null);
        setChainErr(null);
        const tipRes = await fetch(
          process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_blockNumber",
              params: [],
            }),
            cache: "no-store",
          },
        );
        const tipJ = (await tipRes.json()) as { result?: string };
        if (!dead && tipJ.result) {
          setBaseTip(Number.parseInt(tipJ.result, 16));
        }
      } catch (e) {
        if (!dead) {
          setChainErr(e instanceof Error ? e.message : String(e));
        }
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 20_000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [ownerFilter]);

  const indexedIds = useMemo(
    () => new Set(policies.map((p) => p.id.toLowerCase())),
    [policies],
  );

  const pending = useMemo(
    () =>
      onchain.filter((o) => !indexedIds.has(o.policyId.toLowerCase())),
    [onchain, indexedIds],
  );

  const lag =
    studioBlock != null && baseTip != null ? baseTip - studioBlock : null;

  const items = useMemo(() => {
    const own = (owner: string) =>
      !ownerFilter || owner.toLowerCase() === ownerFilter.toLowerCase();

    const list: Item[] = [];
    for (const o of pending) {
      if (!own(o.owner)) continue;
      list.push({
        kind: "pending",
        id: `pending-${o.policyId}`,
        ts: Date.now(),
        onchain: o,
      });
    }
    for (const r of receipts) {
      if (r.owner && !own(r.owner)) continue;
      list.push({
        kind: "fill",
        id: r.id,
        ts: Number(r.timestamp) * 1000,
        receipt: r,
      });
    }
    for (const k of kills) {
      if (k.owner && !own(k.owner)) continue;
      list.push({
        kind: "kill",
        id: k.id,
        ts: Number(k.timestamp) * 1000,
        kill: k,
      });
    }
    for (const p of policies.slice(0, 20)) {
      if (p.owner && !own(p.owner)) continue;
      list.push({
        kind: "policy",
        id: `pol-${p.id}`,
        ts: Number(p.createdAt ?? 0) * 1000,
        policy: p,
      });
    }
    return list.sort((a, b) => {
      if (a.kind === "pending" && b.kind !== "pending") return -1;
      if (b.kind === "pending" && a.kind !== "pending") return 1;
      return b.ts - a.ts;
    });
  }, [receipts, kills, policies, ownerFilter, pending]);

  if (error) {
    return (
      <p className="border-l-2 border-kill/50 pl-4 text-sm text-kill">
        Could not load activity: {error}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {(lag != null && lag > 50) || pending.length > 0 || lastPolicyTx ? (
        <div className="border-l-2 border-warn/60 pl-4" role="status">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-warn">
            Receipt Graph lag
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Studio head
            {studioBlock != null ? ` #${studioBlock}` : ""}
            {baseTip != null ? ` · Base tip #${baseTip}` : ""}
            {lag != null ? ` · ~${lag} blocks behind` : ""}. On-chain clear-signs
            show as <span className="text-paper">pending</span> until indexed.
            Older Sep 6 fills below are real history — not your latest sign.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs">
            {lastPolicyTx && (
              <a
                href={`https://basescan.org/tx/${lastPolicyTx}`}
                target="_blank"
                rel="noreferrer"
                className="text-signal hover:underline"
              >
                Last clear-sign →
              </a>
            )}
            <a
              href={STUDIO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-mute hover:text-paper"
            >
              Studio →
            </a>
          </div>
          {chainErr && (
            <p className="mt-2 text-xs text-kill">RPC: {chainErr}</p>
          )}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={
            lastPolicyTx
              ? "Waiting for Receipt Graph"
              : ownerFilter
                ? "No activity for this wallet yet"
                : "No indexed activity yet"
          }
          body={
            lastPolicyTx
              ? "You signed a protection — indexing can lag when Studio is behind Base. Use the Basescan link above."
              : "Connect Ledger on Protect, clear-sign a policy, then return here for the timeline."
          }
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.id} className="py-5">
              {item.kind === "pending" && (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <Badge tone="warn">pending</Badge>
                      <span className="text-paper">
                        On-chain {policyTypeLabel(item.onchain.policyType)} — not
                        indexed yet
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-mute">
                      block {item.onchain.blockNumber}
                    </span>
                  </div>
                  <a
                    className="mt-2 inline-block font-mono text-xs text-signal hover:underline"
                    href={`https://basescan.org/tx/${item.onchain.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.onchain.txHash.slice(0, 12)}… →
                  </a>
                </>
              )}
              {item.kind === "fill" && (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <Badge tone={item.receipt.compliant ? "success" : "danger"}>
                        fill
                      </Badge>
                      <span className="text-paper">Verified execution</span>
                    </div>
                    <span className="font-mono text-[11px] text-mute">
                      {item.ts ? new Date(item.ts).toLocaleString() : "—"}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-mute">
                    Pyth {usdFrom1e8(item.receipt.pythPrice)} · fill{" "}
                    {usdFrom1e8(item.receipt.executionPrice)}
                  </p>
                  <details className="mt-2 text-xs text-mute">
                    <summary className="cursor-pointer">Evidence</summary>
                    <a
                      className="mt-1 inline-block text-signal hover:underline"
                      href={`https://basescan.org/tx/${item.receipt.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Basescan
                    </a>
                  </details>
                </>
              )}
              {item.kind === "kill" && (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <Badge tone="danger">kill</Badge>
                      <span className="text-paper">All protections stopped</span>
                    </div>
                    <span className="font-mono text-[11px] text-mute">
                      {item.ts ? new Date(item.ts).toLocaleString() : "—"}
                    </span>
                  </div>
                </>
              )}
              {item.kind === "policy" && (
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <Badge tone={item.policy.active ? "success" : "neutral"}>
                      policy
                    </Badge>
                    <span className="text-paper">
                      {policyTypeLabel(item.policy.policyType)}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-mute">
                    {item.policy.active ? "active" : "inactive"}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
