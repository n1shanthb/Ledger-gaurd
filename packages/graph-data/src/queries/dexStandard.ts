/** One Messari DEX AMM Extended document — identical across all dex-amm-extended deployments. */
export const DEX_STANDARD_QUERY = `
query DexStandard($first: Int!) {
  _meta { block { number } }
  protocols(first: 1) {
    schemaVersion
    methodologyVersion
  }
  liquidityPools(
    first: $first
    orderBy: totalValueLockedUSD
    orderDirection: desc
  ) {
    id
    name
    symbol
    totalValueLockedUSD
    inputTokens { symbol }
  }
}
`;

export type DexStandardData = {
  _meta: { block: { number: number } };
  protocols: {
    name?: string;
    slug?: string;
    schemaVersion: string;
    subgraphVersion?: string;
    methodologyVersion: string;
    totalValueLockedUSD?: string;
  }[];
  liquidityPools: {
    id: string;
    name: string;
    symbol: string;
    totalValueLockedUSD: string;
    cumulativeVolumeUSD?: string;
    inputTokens: { id?: string; symbol: string; decimals?: string }[];
  }[];
};
