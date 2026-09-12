/**
 * Thin Key Ring capability broker (Ledger named ask).
 * Agents get scoped, time-boxed handles — never raw session key / OpenRouter key.
 * Master key never leaves Ledger; Key Ring holds keeper secrets.
 */
import { randomUUID } from "node:crypto";
import type { KeeperSecrets } from "./ring";

export type Capability = {
  id: string;
  scope: string;
  expiresAt: number;
};

type CapRecord = Capability & {
  source: KeeperSecrets["source"];
};

const store = new Map<string, CapRecord>();

export type CapabilityBroker = {
  mode: "ring-broker" | "env-broker";
  source: KeeperSecrets["source"];
  mint(scope: string, ttlMs?: number): Capability;
  require(id: string | undefined, needed: string): Capability;
  peek(id: string): Capability | null;
  status(): {
    mode: string;
    source: KeeperSecrets["source"];
    active: number;
    note: string;
  };
};

const DEFAULT_TTL_MS = 120_000;

function scopeGrants(have: string, needed: string): boolean {
  if (have === needed) return true;
  // execute:policy:0xabc grants only that id; mint exact scope
  if (needed.startsWith("execute:policy:")) return have === needed;
  return false;
}

export function createCapabilityBroker(
  secrets: KeeperSecrets,
): CapabilityBroker {
  const mode =
    secrets.source === "ring" ? ("ring-broker" as const) : ("env-broker" as const);

  return {
    mode,
    source: secrets.source,
    mint(scope: string, ttlMs = DEFAULT_TTL_MS): Capability {
      const id = `cap_${randomUUID().slice(0, 12)}`;
      const expiresAt = Date.now() + ttlMs;
      const cap: CapRecord = {
        id,
        scope,
        expiresAt,
        source: secrets.source,
      };
      store.set(id, cap);
      console.log(
        `[lga] broker mint ${scope} ttl=${ttlMs}ms id=${id} (${mode})`,
      );
      return { id, scope, expiresAt };
    },
    require(id: string | undefined, needed: string): Capability {
      if (!id) {
        throw new Error(
          `capability required for ${needed} — broker hands out scopes, never raw API keys`,
        );
      }
      const row = store.get(id);
      if (!row) throw new Error(`capability ${id} unknown or revoked`);
      if (Date.now() > row.expiresAt) {
        store.delete(id);
        throw new Error(`capability ${id} expired for ${needed}`);
      }
      if (!scopeGrants(row.scope, needed)) {
        throw new Error(
          `capability ${id} scope=${row.scope} does not grant ${needed}`,
        );
      }
      return { id: row.id, scope: row.scope, expiresAt: row.expiresAt };
    },
    peek(id: string): Capability | null {
      const row = store.get(id);
      if (!row) return null;
      if (Date.now() > row.expiresAt) {
        store.delete(id);
        return null;
      }
      return { id: row.id, scope: row.scope, expiresAt: row.expiresAt };
    },
    status() {
      let active = 0;
      const now = Date.now();
      for (const [id, row] of store) {
        if (now > row.expiresAt) store.delete(id);
        else active++;
      }
      return {
        mode,
        source: secrets.source,
        active,
        note:
          mode === "ring-broker"
            ? "Key Ring holds keeper secrets; broker mints scoped TTLs — Solver never sees raw keys"
            : "env fallback — broker still scopes pay/execute; prefer LGA_SECRETS_SOURCE=ring for prize",
      };
    },
  };
}

export function publicCapability(cap: Capability) {
  return {
    id: cap.id,
    scope: cap.scope,
    expiresAt: cap.expiresAt,
    expiresInMs: Math.max(0, cap.expiresAt - Date.now()),
  };
}

/**
 * Server-side stamp for a scope (Payer/Autopilot/agent tools).
 * Not a separate agent request API — mint stays in-process; handle never goes to Solver as a secret.
 */
export function stampCapability(
  broker: CapabilityBroker,
  scope: string,
  ttlMs = 60_000,
): Capability {
  return broker.mint(scope, ttlMs);
}

/** Strip session / OpenRouter / Graph key material before LLM or SSE. */
export function redactSecrets(
  text: string,
  secrets?: Pick<
    KeeperSecrets,
    "sessionKey" | "openRouterApiKey" | "graphApiKey"
  >,
): string {
  let out = text;
  if (secrets?.sessionKey) {
    out = out.split(secrets.sessionKey).join("[REDACTED_SESSION]");
  }
  if (secrets?.openRouterApiKey) {
    out = out.split(secrets.openRouterApiKey).join("[REDACTED_OPENROUTER]");
  }
  if (secrets?.graphApiKey) {
    out = out.split(secrets.graphApiKey).join("[REDACTED_GRAPH]");
  }
  out = out.replace(/sk-or-v1-[a-zA-Z0-9]+/g, "[REDACTED_OPENROUTER]");
  return out;
}
