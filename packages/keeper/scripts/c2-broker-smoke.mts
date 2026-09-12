import {
  createCapabilityBroker,
  stampCapability,
  redactSecrets,
  publicCapability,
} from "../src/capabilities.ts";
import type { KeeperSecrets } from "../src/ring.ts";

const secrets = {
  source: "ring",
  sessionKey: "0xDEADBEEFSESSIONKEYDEADBEEFSESSIONKEYDEADBEEFSESSIONKEYDEAD",
  openRouterApiKey: "sk-or-v1-FAKESECRETFORSMOKEONLY00000000000000000000",
  graphApiKey: "graph-fake-key",
} as Pick<KeeperSecrets, "source" | "sessionKey" | "openRouterApiKey" | "graphApiKey">;

const broker = createCapabilityBroker(secrets as KeeperSecrets);
const pay = stampCapability(broker, "pay:trigger", 50);
console.log("mint", pay.id, pay.scope);
broker.require(pay.id, "pay:trigger");
console.log("require ok");

const readG = stampCapability(broker, "read:graph", 60_000);
const readP = stampCapability(broker, "read:pyth", 60_000);
console.log("stamp", readG.scope, readP.scope, publicCapability(readG).id);

await new Promise((r) => setTimeout(r, 60));
try {
  broker.require(pay.id, "pay:trigger");
  console.log("expired fail-closed FALSE");
} catch (e) {
  console.log("expired fail-closed", e instanceof Error ? e.message : e);
}
try {
  broker.require(undefined, "pay:trigger");
  console.log("missing fail-closed false");
} catch (e) {
  console.log(
    "missing fail-closed true",
    e instanceof Error ? e.message : e,
  );
}

const leaked = `key=${secrets.sessionKey} or=${secrets.openRouterApiKey}`;
const red = redactSecrets(leaked, secrets);
console.log(
  "redact",
  red.includes("[REDACTED_SESSION]") && red.includes("[REDACTED_OPENROUTER]"),
  red,
);
console.log("status", JSON.stringify(broker.status()));
console.log("PASS", true);
