import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  PolicyCreated,
  PolicyRevoked,
  ExecutionReceipt as ExecutionReceiptEvent,
  KillSwitchActivated,
} from "../generated/GuardianPolicyManager/GuardianPolicyManager";
import { Policy, ExecutionReceipt, KillSwitch } from "../generated/schema";

function policyTypeFrom(n: i32): string {
  if (n == 1) return "TAKE_PROFIT";
  if (n == 2) return "LP_STOP_LOSS";
  if (n == 3) return "BUY_DIP";
  return "STOP_LOSS";
}

function triggerFrom(n: i32): string {
  if (n == 1) return "TAKE_PROFIT";
  return "STOP_LOSS";
}

export function handlePolicyCreated(event: PolicyCreated): void {
  let policy = new Policy(event.params.policyId);
  policy.owner = event.params.owner;
  policy.token = event.params.token;
  policy.policyType = policyTypeFrom(event.params.policyType);
  policy.stopLossPrice = event.params.stopLossPrice;
  policy.takeProfitPrice = event.params.takeProfitPrice;
  policy.maxAmount = event.params.maxAmount;
  policy.maxSlippageBps = event.params.maxSlippageBps;
  policy.active = true;
  policy.createdAt = event.block.timestamp;
  policy.save();
}

export function handlePolicyRevoked(event: PolicyRevoked): void {
  let policy = Policy.load(event.params.policyId);
  if (policy == null) return;
  policy.active = false;
  policy.revokedAt = event.block.timestamp;
  policy.save();
}

export function handleExecutionReceipt(event: ExecutionReceiptEvent): void {
  let receipt = new ExecutionReceipt(event.params.receiptId);
  let policy = Policy.load(event.params.policyId);
  if (policy == null) {
    policy = new Policy(event.params.policyId);
    policy.owner = event.params.owner;
    policy.token = Bytes.empty();
    policy.policyType = "STOP_LOSS";
    policy.stopLossPrice = BigInt.zero();
    policy.takeProfitPrice = BigInt.zero();
    policy.maxAmount = BigInt.zero();
    policy.maxSlippageBps = event.params.maxSlippageBps;
    policy.active = false;
    policy.createdAt = event.block.timestamp;
  }
  policy.active = false;
  policy.revokedAt = event.block.timestamp;
  policy.save();

  receipt.policy = policy.id;
  receipt.owner = event.params.owner;
  receipt.triggerType = triggerFrom(event.params.triggerType);
  receipt.pythPrice = event.params.pythPrice;
  receipt.executionPrice = event.params.executionPrice;
  receipt.maxSlippageBps = event.params.maxSlippageBps;
  receipt.actualSlippageBps = event.params.actualSlippageBps;
  receipt.compliant = event.params.compliant;
  receipt.txHash = event.transaction.hash;
  receipt.timestamp = event.block.timestamp;
  receipt.save();
}

export function handleKillSwitchActivated(event: KillSwitchActivated): void {
  let ks = new KillSwitch(event.transaction.hash);
  ks.owner = event.params.owner;
  ks.policiesRevoked = event.params.policiesRevoked;
  ks.timestamp = event.params.timestamp;
  ks.save();
}
