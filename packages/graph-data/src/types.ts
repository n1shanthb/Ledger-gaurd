export type Provenance = {
  deploymentId: string;
  protocolSlug: string;
  network: string;
  schemaVersion?: string;
  methodologyVersion?: string;
  blockNumber: number;
};

export type DexPoolRow = Provenance & {
  poolId: string;
  name: string;
  symbol: string;
  pairLabel: string;
  totalValueLockedUSD: number;
  cumulativeVolumeUSD: number;
};

export type LendingMarketRow = Provenance & {
  marketId: string;
  name: string;
  assetSymbol: string;
  totalValueLockedUSD: number;
  totalDepositBalanceUSD: number;
  totalBorrowBalanceUSD: number;
  utilization: number | null;
  supplyApy: number | null;
  borrowApy: number | null;
};

export type AgentPeer = Provenance & {
  id: string;
  name?: string;
  description?: string;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  trustScore?: number;
  metadata?: Record<string, unknown>;
};

export type ReceiptPolicy = {
  id: string;
  owner: string;
  token: string;
  policyType: string | number;
  stopLossPrice: string;
  takeProfitPrice: string;
  maxAmount: string;
  active: boolean;
};
