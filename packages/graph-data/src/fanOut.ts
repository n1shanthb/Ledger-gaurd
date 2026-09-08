import type { DeploymentEntry, SchemaFamily } from "./registry";
import { deploymentsFor } from "./registry";
import { gatewayRequest } from "./client";

export type FanOutResult<T> = {
  deploymentId: string;
  protocolSlug: string;
  network: DeploymentEntry["network"];
  schemaVersion?: string;
  methodologyVersion?: string;
  blockNumber: number;
  data: T;
};

export type FanOutFailure = {
  deploymentId: string;
  protocolSlug: string;
  network: DeploymentEntry["network"];
  error: string;
};

export type FanOutResponse<T> = {
  ok: FanOutResult<T>[];
  failed: FanOutFailure[];
};

type MetaProtocols = {
  _meta?: { block?: { number?: number } };
  protocols?: {
    schemaVersion?: string;
    methodologyVersion?: string;
    name?: string;
    slug?: string;
  }[];
};

/**
 * Run ONE GraphQL document against every enabled deployment in a schema family.
 */
export async function fanOutStandardQuery<T extends MetaProtocols>(opts: {
  family: SchemaFamily;
  document: string;
  variables?: Record<string, unknown>;
  deployments?: DeploymentEntry[];
  network?: DeploymentEntry["network"];
  requestOpts?: {
    maxAttempts?: number;
    timeoutMs?: number;
    baseMs?: number;
  };
}): Promise<FanOutResponse<T>> {
  const list =
    opts.deployments ??
    deploymentsFor(opts.family, {
      enabledOnly: true,
      network: opts.network,
    });

  const settled = await Promise.allSettled(
    list.map(async (d) => {
      const data = await gatewayRequest<T>(
        d.deploymentId,
        opts.document,
        opts.variables,
        opts.requestOpts,
      );
      const blockNumber = data._meta?.block?.number;
      if (blockNumber == null || blockNumber <= 0) {
        throw new Error(`missing _meta.block for ${d.deploymentId}`);
      }
      const proto = data.protocols?.[0];
      return {
        deploymentId: d.deploymentId,
        protocolSlug: d.protocolSlug,
        network: d.network,
        schemaVersion: proto?.schemaVersion ?? d.schemaVersion,
        methodologyVersion: proto?.methodologyVersion,
        blockNumber,
        data,
      } satisfies FanOutResult<T>;
    }),
  );

  const ok: FanOutResult<T>[] = [];
  const failed: FanOutFailure[] = [];
  settled.forEach((s, i) => {
    const d = list[i]!;
    if (s.status === "fulfilled") ok.push(s.value);
    else {
      failed.push({
        deploymentId: d.deploymentId,
        protocolSlug: d.protocolSlug,
        network: d.network,
        error: s.reason instanceof Error ? s.reason.message : String(s.reason),
      });
    }
  });
  return { ok, failed };
}
