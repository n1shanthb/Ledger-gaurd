"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEther, formatUnits } from "viem";
import { useProtection } from "@/components/ProtectionProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import {
  STUDIO_URL,
  SUBGRAPH_QUERY_URL,
  tokenLabel,
  usdFrom1e8,
} from "@/lib/constants";
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

function triggerLabel(t: string | number): string {
  const s = String(t);
  if (s === "1" || s === "TAKE_PROFIT" || t === 1) return "Take-profit band crossed";
  return "Stop-loss band crossed";
}

function shortId(id: string) {
  if (!id || id.length < 12) return id || "—";
  return `${id.slice(0, 10)}…${id.slice(-6)}`;
}

function formatTs(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function formatMaxAmount(token: string, raw: string): string {
  try {
    const v = BigInt(raw);
    if (v <= 0n) return "—";
    const t = token.toLowerCase();
    if (t === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") {
      return `${formatUnits(v, 6)} USDC`;
    }
    return `${formatEther(v)} ${tokenLabel(token).split(" ")[0] ?? "ETH"}`;
  } catch {
    return "—";
  }
}

function bpsPct(bps: string | undefined): string {
  const n = Number(bps);
  if (!Number.isFinite(n) || n < 0) return "—";
  return `${(n / 100).toFixed(n % 100 === 0 ? 0 : 2)}%`;
}

type Item =
  | { kind: "fill"; id: string; ts: number; receipt: ReceiptRow }
  | { kind: "kill"; id: string; ts: number; kill: KillRow }
  | { kind: "policy"; id: string; ts: number; policy: PolicyRow }
  | { kind: "pending"; id: string; ts: number; onchain: OnchainPolicyCreated };

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-line/70 py-2.5 last:border-0 sm:grid-cols-[9rem_1fr]">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
        {label}
      </dt>
      <dd className="text-sm text-paper">{value}</dd>
    </div>
  );
}

function ActivityDetail({
  item,
  onClose,
}: {
  item: Item;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  let title = "Activity";
  let body: ReactNode = null;
  let evidenceHref: string | null = null;

  if (item.kind === "fill") {
    const r = item.receipt;
    const p = r.policy;
    title = "Verified fill";
    evidenceHref = `https://basescan.org/tx/${r.txHash}`;
    body = (
      <>
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
            What you set
          </p>
          <dl className="mt-2">
            <DetailRow label="Type" value={policyTypeLabel(p.policyType)} />
            <DetailRow label="Asset" value={tokenLabel(p.token)} />
            <DetailRow
              label="Stop"
              value={
                Number(p.stopLossPrice) > 0
                  ? usdFrom1e8(p.stopLossPrice)
                  : "Off"
              }
            />
            <DetailRow
              label="Take"
              value={
                Number(p.takeProfitPrice) > 0
                  ? usdFrom1e8(p.takeProfitPrice)
                  : "Off"
              }
            />
            <DetailRow
              label="Max size"
              value={formatMaxAmount(p.token, p.maxAmount)}
            />
            <DetailRow
              label="Slippage cap"
              value={bpsPct(p.maxSlippageBps || r.maxSlippageBps)}
            />
            <DetailRow
              label="Clear-signed"
              value={formatTs(Number(p.createdAt) * 1000)}
            />
          </dl>
        </section>
        <section className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
            Condition met
          </p>
          <dl className="mt-2">
            <DetailRow label="Trigger" value={triggerLabel(r.triggerType)} />
            <DetailRow label="Pyth at hit" value={usdFrom1e8(r.pythPrice)} />
            <DetailRow label="When" value={formatTs(item.ts)} />
          </dl>
        </section>
        <section className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
            Execution
          </p>
          <dl className="mt-2">
            <DetailRow
              label="Fill price"
              value={usdFrom1e8(r.executionPrice)}
            />
            <DetailRow
              label="Slippage used"
              value={bpsPct(r.actualSlippageBps)}
            />
            <DetailRow
              label="Compliant"
              value={r.compliant ? "Yes — within signed band" : "No"}
            />
            <DetailRow label="Policy id" value={shortId(p.id)} />
          </dl>
        </section>
      </>
    );
  } else if (item.kind === "policy") {
    const p = item.policy;
    title = policyTypeLabel(p.policyType);
    body = (
      <dl>
        <DetailRow
          label="Status"
          value={p.active ? "Active — watching" : "Inactive"}
        />
        <DetailRow label="Asset" value={tokenLabel(p.token)} />
        <DetailRow
          label="Stop"
          value={
            Number(p.stopLossPrice) > 0 ? usdFrom1e8(p.stopLossPrice) : "Off"
          }
        />
        <DetailRow
          label="Take"
          value={
            Number(p.takeProfitPrice) > 0
              ? usdFrom1e8(p.takeProfitPrice)
              : "Off"
          }
        />
        <DetailRow
          label="Max size"
          value={formatMaxAmount(p.token, p.maxAmount)}
        />
        <DetailRow label="Slippage cap" value={bpsPct(p.maxSlippageBps)} />
        <DetailRow label="Clear-signed" value={formatTs(item.ts)} />
        <DetailRow label="Policy id" value={shortId(p.id)} />
      </dl>
    );
  } else if (item.kind === "pending") {
    const o = item.onchain;
    title = "Pending index";
    evidenceHref = `https://basescan.org/tx/${o.txHash}`;
    body = (
      <dl>
        <DetailRow label="Type" value={policyTypeLabel(o.policyType)} />
        <DetailRow label="Asset" value={tokenLabel(o.token)} />
        <DetailRow label="Block" value={String(o.blockNumber)} />
        <DetailRow
          label="Note"
          value="On Base — waiting for Receipt Graph Studio to catch tip"
        />
        <DetailRow label="Policy id" value={shortId(o.policyId)} />
      </dl>
    );
  } else {
    title = "Kill switch";
    body = (
      <dl>
        <DetailRow
          label="Revoked"
          value={`${item.kill.policiesRevoked} protection(s)`}
        />
        <DetailRow label="When" value={formatTs(item.ts)} />
      </dl>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/90 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto border border-line bg-ink px-5 py-6 sm:px-7"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
          Activity detail
        </p>
        <h2
          id="activity-detail-title"
          className="mt-2 font-display text-3xl tracking-tight text-paper"
        >
          {title}
        </h2>
        <div className="mt-6">{body}</div>
        <div className="mt-8 flex flex-wrap gap-3">
          {evidenceHref && (
            <a
              href={evidenceHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-mist px-5 text-sm font-semibold text-paper hover:border-paper"
            >
              Basescan →
            </a>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  const [open, setOpen] = useState<Item | null>(null);

  useEffect(() => {
    let dead = false;
    let lastMetaAt = 0;
    let lastMeta: Awaited<ReturnType<typeof fetchStudioMeta>> = null;
    const metaPollMs = Number(
      process.env.NEXT_PUBLIC_GRAPH_META_POLL_MS ?? 180_000,
    );
    const indexed = new Set(policies.map((p) => p.id.toLowerCase()));

    const tick = async () => {
      try {
        const rows = await fetchRecentPolicyCreated({
          owner: ownerFilter,
          lookbackBlocks: 12_000,
        });
        if (dead) return;
        setOnchain(rows);
        setChainErr(null);

        const pendingNow = rows.some(
          (o) => !indexed.has(o.policyId.toLowerCase()),
        );
        const metaDue =
          lastMeta == null ||
          Date.now() - lastMetaAt >= metaPollMs ||
          pendingNow;
        if (metaDue) {
          const meta = await fetchStudioMeta(SUBGRAPH_QUERY_URL);
          if (dead) return;
          lastMeta = meta;
          lastMetaAt = Date.now();
          setStudioBlock(meta?.blockNumber ?? null);
        }

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
    // On-chain pending check every 20s; Receipt Graph _meta only when due / pending
    const id = setInterval(() => void tick(), 20_000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [ownerFilter, policies]);

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
            <li key={item.id} className="py-1">
              <button
                type="button"
                onClick={() => setOpen(item)}
                className="w-full cursor-pointer py-4 text-left transition hover:bg-panel/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                {item.kind === "pending" && (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <Badge tone="warn">pending</Badge>
                        <span className="text-paper">
                          On-chain {policyTypeLabel(item.onchain.policyType)} —
                          not indexed yet
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-mute">
                        block {item.onchain.blockNumber}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-mute">
                      Open for details · {item.onchain.txHash.slice(0, 12)}…
                    </p>
                  </>
                )}
                {item.kind === "fill" && (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <Badge
                          tone={item.receipt.compliant ? "success" : "danger"}
                        >
                          fill
                        </Badge>
                        <span className="text-paper">
                          {policyTypeLabel(item.receipt.policy.policyType)} ·{" "}
                          {triggerLabel(item.receipt.triggerType)}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-mute">
                        {formatTs(item.ts)}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-mute">
                      Set stop{" "}
                      {Number(item.receipt.policy.stopLossPrice) > 0
                        ? usdFrom1e8(item.receipt.policy.stopLossPrice)
                        : "—"}{" "}
                      · Pyth {usdFrom1e8(item.receipt.pythPrice)} · fill{" "}
                      {usdFrom1e8(item.receipt.executionPrice)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-mute">
                      Open detail →
                    </p>
                  </>
                )}
                {item.kind === "kill" && (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <Badge tone="danger">kill</Badge>
                        <span className="text-paper">
                          All protections stopped
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-mute">
                        {formatTs(item.ts)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-mute">
                      Open detail →
                    </p>
                  </>
                )}
                {item.kind === "policy" && (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <Badge
                          tone={item.policy.active ? "success" : "neutral"}
                        >
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
                    <p className="mt-2 font-mono text-xs text-mute">
                      {tokenLabel(item.policy.token)}
                      {Number(item.policy.stopLossPrice) > 0
                        ? ` · stop ${usdFrom1e8(item.policy.stopLossPrice)}`
                        : ""}
                      {Number(item.policy.takeProfitPrice) > 0
                        ? ` · take ${usdFrom1e8(item.policy.takeProfitPrice)}`
                        : ""}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-mute">
                      Open detail →
                    </p>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <ActivityDetail item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
