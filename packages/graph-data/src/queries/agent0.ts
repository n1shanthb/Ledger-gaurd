/** Agent0 / ERC-8004 registry — fields probed softly; widen after live introspect. */
export const AGENT0_REGISTRY_QUERY = `
query Agent0Registry($first: Int!) {
  _meta { block { number } }
  agents(first: $first) {
    id
    name
    description
    mcpEndpoint
    a2aEndpoint
    trustScore
    metadata
  }
}
`;

/** Fallback if \`agents\` is missing — try common alternate roots. */
export const AGENT0_META_ONLY = `
query Agent0Meta {
  _meta { block { number } }
}
`;

export type Agent0RawAgent = {
  id: string;
  name?: string | null;
  description?: string | null;
  mcpEndpoint?: string | null;
  a2aEndpoint?: string | null;
  trustScore?: number | string | null;
  metadata?: unknown;
};

export type Agent0RegistryData = {
  _meta: { block: { number: number } };
  agents?: Agent0RawAgent[];
};
