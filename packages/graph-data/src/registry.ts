export type SchemaFamily = "dex-amm-extended" | "lending-cdp" | "agent0";

export type DeploymentEntry = {
  deploymentId: string;
  protocolSlug: string;
  network: "base" | "ethereum" | "optimism" | "arbitrum";
  family: SchemaFamily;
  schemaVersion: string;
  enabled: boolean;
  disabledReason?: string;
};

/**
 * Official Aave V3 Base subgraph (Gateway) — live TVL, but **not** Messari lending-cdp.
 */
export const AAVE_V3_BASE_SUBGRAPH_ID =
  "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF";

/** Messari aave-v3-base — currently no allocations on Gateway. */
export const AAVE_V3_BASE_MESSARI_ID =
  "D7mapexM5ZsQckLJai2FawTKXJ7CqYGKM8PErnS3cJi9";

/** Pinned Messari / Agent0 gateway subgraph IDs (Base-first). */
export const DEPLOYMENTS: DeploymentEntry[] = [
  {
    deploymentId: "FUbEPQw1oMghy39fwWBFY5fE6MXPXZQtjncQy2cXdrNS",
    protocolSlug: "uniswap-v3",
    network: "base",
    family: "dex-amm-extended",
    schemaVersion: "4.0.1",
    enabled: true,
  },
  {
    deploymentId: "EgnS9YE1avupkvCNj9fHnJxppfEmNNywYJtghqiu2pd9",
    protocolSlug: "uniswap-v3",
    network: "optimism",
    family: "dex-amm-extended",
    schemaVersion: "4.0.1",
    enabled: true,
  },
  {
    deploymentId: "FQ6JYszEKApsBpAmiHesRsd9Ygc6mzmpNRANeVQFYoVX",
    protocolSlug: "uniswap-v3",
    network: "arbitrum",
    family: "dex-amm-extended",
    schemaVersion: "4.0.1",
    enabled: true,
  },
  {
    deploymentId: AAVE_V3_BASE_MESSARI_ID,
    protocolSlug: "aave-v3",
    network: "base",
    family: "lending-cdp",
    schemaVersion: "3.1.0",
    enabled: false,
    disabledReason:
      "Messari Base Aave offline · using ETH/ARB Aave + Base Compound/Seamless",
  },
  {
    deploymentId: "JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
    protocolSlug: "aave-v3",
    network: "ethereum",
    family: "lending-cdp",
    schemaVersion: "3.1.0",
    enabled: true,
  },
  {
    deploymentId: "4xyasjQeREe7PxnF6wVdobZvCw5mhoHZq3T7guRpuNPf",
    protocolSlug: "aave-v3",
    network: "arbitrum",
    family: "lending-cdp",
    schemaVersion: "3.1.0",
    enabled: true,
  },
  {
    deploymentId: "2u4mWUV4xS19ef1MbnxZHWLLMwdPxtVifH46JbonXwXP",
    protocolSlug: "seamless",
    network: "base",
    family: "lending-cdp",
    schemaVersion: "3.1.0",
    enabled: true,
  },
  {
    deploymentId: "AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9",
    protocolSlug: "compound-v3",
    network: "base",
    family: "lending-cdp",
    schemaVersion: "3.1.0",
    enabled: true,
  },
  {
    deploymentId: "33ex1ExmYQtwGVwri1AP3oMFPGSce6YbocBP7fWbsBrg",
    protocolSlug: "moonwell",
    network: "base",
    family: "lending-cdp",
    schemaVersion: "2.0.1",
    enabled: false,
    disabledReason: "schema 2.0.1 — not compatible with lending 3.1.0 standard query",
  },
  {
    deploymentId: "6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT",
    protocolSlug: "agent0",
    network: "base",
    family: "agent0",
    schemaVersion: "1.0.0",
    enabled: true,
  },
];

export function deploymentsFor(
  family: SchemaFamily,
  opts?: { network?: DeploymentEntry["network"]; enabledOnly?: boolean },
): DeploymentEntry[] {
  const enabledOnly = opts?.enabledOnly ?? true;
  return DEPLOYMENTS.filter((d) => {
    if (d.family !== family) return false;
    if (enabledOnly && !d.enabled) return false;
    if (opts?.network && d.network !== opts.network) return false;
    return true;
  });
}

export const AGENT0_ID = "6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT";
export const RECEIPT_GRAPH_DEFAULT =
  "https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4";
