/** One Messari Lending/CDP document — identical across all lending-cdp deployments. */
export const LENDING_STANDARD_QUERY = `
query LendingStandard($first: Int!) {
  _meta { block { number } }
  protocols(first: 1) {
    name
    slug
    schemaVersion
    subgraphVersion
    methodologyVersion
    totalValueLockedUSD
  }
  markets(
    first: $first
    orderBy: totalValueLockedUSD
    orderDirection: desc
  ) {
    id
    name
    inputToken { id symbol decimals }
    totalValueLockedUSD
    totalDepositBalanceUSD
    totalBorrowBalanceUSD
    rates {
      side
      type
      rate
    }
  }
}
`;

export type LendingStandardData = {
  _meta: { block: { number: number } };
  protocols: {
    name: string;
    slug: string;
    schemaVersion: string;
    subgraphVersion: string;
    methodologyVersion: string;
    totalValueLockedUSD: string;
  }[];
  markets: {
    id: string;
    name: string;
    inputToken: { id: string; symbol: string; decimals: string };
    totalValueLockedUSD: string;
    totalDepositBalanceUSD: string;
    totalBorrowBalanceUSD: string;
    rates: { side: string; type: string; rate: string }[];
  }[];
};
