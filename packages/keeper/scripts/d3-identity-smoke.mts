import {
  parseAgentHeader,
  tagHederaPaymentRef,
  paymentAuditBridgeStatus,
  agentRosterStatus,
  LGA_AGENTS,
} from "../src/agentIdentity.ts";
import type { KeeperSecrets } from "../src/ring.ts";

const secrets = {
  source: "ring",
  hcsTopicId: "0.0.10423816",
  paymentAuditLog: "0x689ae72edebbf31c59e79b3cd0926a7bd638f495",
  hederaNetwork: "hedera:testnet",
} as KeeperSecrets;

const a1 = parseAgentHeader("payer");
const a2 = parseAgentHeader(undefined);
const a3 = parseAgentHeader("nope");
console.log("parse", a1, a2, a3);

const tagged = tagHederaPaymentRef(
  "https://hashscan.io/testnet/transaction/0.0.1",
  "payer",
);
const taggedFill = tagHederaPaymentRef(tagged, "payer");
console.log("tag", tagged);
console.log("tag-idempotent", taggedFill === tagged);

const bridgeOn = paymentAuditBridgeStatus(secrets);
const bridgeOff = paymentAuditBridgeStatus({
  ...secrets,
  paymentAuditLog: "",
} as KeeperSecrets);
console.log("bridge-on", JSON.stringify(bridgeOn));
console.log("bridge-off", JSON.stringify(bridgeOff));

process.env.HCS_ROSTER_REF = "hcs://0.0.10423816/99";
const { ensureAgentRoster } = await import("../src/agentIdentity.ts");
const pinned = await ensureAgentRoster(secrets);
console.log("roster-pin", pinned);

const status = agentRosterStatus(secrets);
console.log(
  "status",
  JSON.stringify({
    agents: status.agents.length === LGA_AGENTS.length,
    lastRosterRef: status.lastRosterRef,
    headerTrust: status.headerTrust,
    graphBridge: status.graphBridge.configured,
  }),
);

const pass =
  a1 === "payer" &&
  a2 === "unknown" &&
  a3 === "unknown" &&
  tagged.includes("agent=payer") &&
  taggedFill === tagged &&
  bridgeOn.configured === true &&
  bridgeOff.configured === false &&
  pinned === "hcs://0.0.10423816/99" &&
  status.lastRosterRef === "hcs://0.0.10423816/99";

console.log("PASS", pass);
if (!pass) process.exit(1);
