"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  BorrowDecision,
  CompareDexResult,
  CompareLendingResult,
  DexDecision,
  SwapGateResult,
} from "@/lib/lgaGraphData";

type Agent0Payload = {
  peers: unknown[];
  blockNumber: number;
  deploymentId: string;
  error?: string;
};

export type ComposeDecisionsPayload = {
  lending: BorrowDecision;
  dex: DexDecision;
  gate: SwapGateResult;
  note?: string;
};

async function gatewayGet<T>(
  resource: string,
  first: number,
  crossChain = false,
): Promise<T> {
  const qs = new URLSearchParams({
    resource,
    first: String(first),
  });
  if (crossChain) qs.set("crossChain", "1");
  const res = await fetch(`/api/gateway?${qs}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : `gateway ${res.status}`,
    );
  }
  if (typeof (json as { error?: unknown }).error === "string") {
    const msg = (json as { error: string }).error;
    if (resource === "agent0") return json;
    throw new Error(msg);
  }
  return json;
}

export function useComposeDecisions(opts?: {
  enabled?: boolean;
  crossChain?: boolean;
}) {
  return useQuery({
    queryKey: ["gateway", "decisions", opts?.crossChain ? 1 : 0],
    queryFn: () =>
      gatewayGet<ComposeDecisionsPayload>("decisions", 8, opts?.crossChain),
    enabled: opts?.enabled ?? true,
    staleTime: 40_000,
  });
}

export function useCompareLendingMarkets(opts?: {
  first?: number;
  enabled?: boolean;
}) {
  const first = opts?.first ?? 10;
  return useQuery({
    queryKey: ["gateway", "compare-lending", first],
    queryFn: () =>
      gatewayGet<
        CompareLendingResult & {
          failed?: { protocolSlug: string; error: string }[];
        }
      >("lending", first),
    enabled: opts?.enabled ?? true,
  });
}

export function useCompareDexPools(opts?: {
  first?: number;
  enabled?: boolean;
}) {
  const first = opts?.first ?? 10;
  return useQuery({
    queryKey: ["gateway", "compare-dex", first],
    queryFn: () => gatewayGet<CompareDexResult>("dex", first),
    enabled: opts?.enabled ?? true,
  });
}

export function useAgent0Registry(opts?: {
  first?: number;
  enabled?: boolean;
}) {
  const first = opts?.first ?? 25;
  return useQuery({
    queryKey: ["gateway", "agent0", first],
    queryFn: () => gatewayGet<Agent0Payload>("agent0", first),
    enabled: opts?.enabled ?? true,
  });
}
