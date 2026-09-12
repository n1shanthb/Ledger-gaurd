/**
 * Light HCS agent identity for the six LGA roles.
 * Roster + payment memos on HCS; Receipt Graph indexes via PaymentAudit.hcsRef.
 * x-lga-agent is honor-system from our Payer/Autopilot/CLI — not cryptographic HCS-14.
 */
import type { KeeperSecrets } from "./ring";
import { submitHcsMemo, hcsHashscanUrl } from "./hcsAudit";

export const LGA_AGENTS = [
  "composer",
  "autopilot",
  "solver",
  "payer",
  "driver",
  "clerk",
] as const;

export type LgaAgentId = (typeof LGA_AGENTS)[number];

const ALLOW = new Set<string>(LGA_AGENTS);

let lastRosterRef: string | null = null;
let lastRosterError: string | null = null;
let rosterPublished = false;

export function parseAgentHeader(
  raw: string | string[] | undefined,
): LgaAgentId | "cli" | "unknown" {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (!v) return "unknown";
  if (v === "cli") return "cli";
  if (ALLOW.has(v)) return v as LgaAgentId;
  return "unknown";
}

/** Tag Hedera payment ref so Graph PaymentAudit rows carry agent even without schema field. */
export function tagHederaPaymentRef(
  hederaPaymentRef: string,
  agentId: string,
): string {
  const base = hederaPaymentRef.trim();
  const tag = `agent=${agentId}`;
  if (!base) return tag;
  if (base.includes(tag)) return base.slice(0, 200);
  return `${base}|${tag}`.slice(0, 200);
}

export function paymentAuditBridgeStatus(secrets: KeeperSecrets) {
  const addr = (
    process.env.PAYMENT_AUDIT_LOG?.trim() ||
    secrets.paymentAuditLog?.trim() ||
    ""
  ).trim();
  const configured = Boolean(addr && addr !== "0x");
  return {
    configured,
    contract: configured ? addr : null,
    note: configured
      ? "PaymentAudit on Base indexes hcsRef + hederaPaymentRef (incl. agent= tag)"
      : "PAYMENT_AUDIT_LOG unset — Graph↔Hedera bridge inactive (HCS memos still work)",
  };
}

export function agentRosterStatus(secrets: KeeperSecrets) {
  const topic =
    process.env.HCS_TOPIC_ID?.trim() || secrets.hcsTopicId?.trim() || "";
  const bridge = paymentAuditBridgeStatus(secrets);
  return {
    scheme: "hcs-light",
    note: "Key Ring holds keeper secrets; Hedera names which agent spent the pay capability",
    headerTrust: "x-lga-agent honor-system from keeper consumers (not signed HCS-14)",
    agents: [...LGA_AGENTS],
    topic: topic || null,
    topicUrl: topic
      ? hcsHashscanUrl(secrets.hederaNetwork, `hcs://${topic}/0`)
      : null,
    lastRosterRef,
    lastRosterError,
    graphBridge: bridge,
  };
}

/**
 * Once per process: publish agent roster to HCS (same topic as payment memos).
 * Pin with HCS_ROSTER_REF=hcs://topic/seq to skip re-publish after first live roster.
 */
export async function ensureAgentRoster(
  secrets: KeeperSecrets,
): Promise<string | null> {
  if (rosterPublished) return lastRosterRef;

  const pinned = process.env.HCS_ROSTER_REF?.trim();
  if (pinned?.startsWith("hcs://")) {
    lastRosterRef = pinned;
    lastRosterError = null;
    rosterPublished = true;
    console.log(`[lga] agent roster pinned ${pinned}`);
    return pinned;
  }

  if (process.env.HCS_SKIP_ROSTER === "1") {
    lastRosterError = "HCS_SKIP_ROSTER=1";
    return null;
  }

  const topic = process.env.HCS_TOPIC_ID || secrets.hcsTopicId;
  if (!topic) {
    lastRosterError = "HCS_TOPIC_ID unset";
    return null;
  }

  const ref = await submitHcsMemo(secrets, {
    type: "lga.agent.roster",
    scheme: "hcs-light",
    keeper: "lga-keeper",
    agents: Object.fromEntries(
      LGA_AGENTS.map((id) => [
        id,
        {
          id,
          role:
            id === "payer" || id === "autopilot"
              ? "hedera-x402-consumer"
              : id === "driver"
                ? "base-session-fill"
                : id === "clerk"
                  ? "receipt-graph"
                  : "in-process",
        },
      ]),
    ),
    bridge: "PaymentAudit.hcsRef links Hedera memos into Receipt Graph",
  });

  if (ref) {
    lastRosterRef = ref;
    lastRosterError = null;
    rosterPublished = true;
    console.log(`[lga] agent roster ${ref}`);
    return ref;
  }

  lastRosterError = "submitHcsMemo returned null";
  return null;
}
