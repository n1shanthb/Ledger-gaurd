import type { FanOutResult } from "../fanOut";
import type { LendingStandardData } from "../queries/lendingStandard";
import type { LendingMarketRow } from "../types";

function num(v: string | number | undefined | null): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickRate(
  rates: { side: string; type: string; rate: string }[] | undefined,
  side: string,
  typeHint: string,
): number | null {
  if (!rates?.length) return null;
  const hit =
    rates.find(
      (x) =>
        x.side?.toUpperCase() === side.toUpperCase() &&
        x.type?.toUpperCase().includes(typeHint.toUpperCase()),
    ) ??
    rates.find((x) => x.side?.toUpperCase() === side.toUpperCase());
  if (!hit) return null;
  const n = num(hit.rate);
  return Number.isFinite(n) ? n : null;
}

export function normalizeLendingMarkets(
  results: FanOutResult<LendingStandardData>[],
): LendingMarketRow[] {
  const rows: LendingMarketRow[] = [];
  for (const r of results) {
    for (const m of r.data.markets ?? []) {
      const deposit = num(m.totalDepositBalanceUSD);
      const borrow = num(m.totalBorrowBalanceUSD);
      const utilization = deposit > 0 ? borrow / deposit : null;
      rows.push({
        deploymentId: r.deploymentId,
        protocolSlug: r.protocolSlug,
        network: r.network,
        schemaVersion: r.schemaVersion,
        methodologyVersion: r.methodologyVersion,
        blockNumber: r.blockNumber,
        marketId: m.id,
        name: m.name,
        assetSymbol: m.inputToken?.symbol ?? "?",
        totalValueLockedUSD: num(m.totalValueLockedUSD),
        totalDepositBalanceUSD: deposit,
        totalBorrowBalanceUSD: borrow,
        utilization,
        supplyApy: pickRate(m.rates, "LENDER", "VARIABLE") ?? pickRate(m.rates, "SUPPLY", "VARIABLE"),
        borrowApy: pickRate(m.rates, "BORROWER", "VARIABLE") ?? pickRate(m.rates, "BORROW", "VARIABLE"),
      });
    }
  }
  return rows.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);
}
