import assert from "node:assert/strict";
import {
  canAdvance,
  killBlocked,
  labelPaymentAttempt,
  liveSignBlocked,
  paymentIsNotFill,
} from "../lib/journeyRules";

assert.equal(canAdvance("device", "asset"), true);
assert.equal(canAdvance("device", "review"), false);
assert.equal(canAdvance("monitor", "kill"), true);
assert.equal(liveSignBlocked("live", false), true);
assert.equal(liveSignBlocked("live", true), false);
assert.equal(liveSignBlocked("demo", false), false);
assert.equal(killBlocked(false, true, false), true);
assert.equal(killBlocked(true, false, false), true);
assert.equal(killBlocked(true, true, false), false);
assert.equal(paymentIsNotFill(0), true);
assert.equal(paymentIsNotFill(1), false);
assert.equal(labelPaymentAttempt(0), "payment / eval");
assert.equal(labelPaymentAttempt(2), "eval + fill");

console.log("journeyRules ok");
