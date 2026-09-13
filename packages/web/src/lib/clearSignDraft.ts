import type { Address } from "viem";
import { GPM_V2 } from "@/lib/constants";
import { draftToPolicyForm } from "@/lib/draftToPolicyForm";
import {
  ensureLedgerSession,
  getLedgerEthAddress,
  isWebHidSupported,
} from "@/lib/ledger";
import {
  signAndSendSetGuardianPolicy,
  type PolicySignResult,
} from "@/lib/policyTx";
import type { PolicyDraft } from "@/lib/agentEvents";

export type ClearSignDraftResult =
  | { ok: true; txHash: string; from: Address; message: string }
  | { ok: false; message: string };

/**
 * Real DMK clear-sign for an agent PolicyDraft (OLED on device).
 * Reuses Protect WebHID session when open; otherwise prompts connect.
 */
export async function clearSignPolicyDraft(opts: {
  draft: PolicyDraft;
  accountIndex: number;
  onLog?: (msg: string) => void;
}): Promise<ClearSignDraftResult> {
  if (!isWebHidSupported()) {
    return {
      ok: false,
      message:
        "WebHID needs Chrome or Edge on desktop with a USB Ledger.",
    };
  }
  if (!opts.draft.primary.amount.trim()) {
    return { ok: false, message: "Set an amount on the draft before clear-sign." };
  }
  const form = draftToPolicyForm(opts.draft);
  const buy = form.policyType === 3;
  const bandOk = buy
    ? Number(form.takeProfitUsd) > 0 || Number(form.stopLossUsd) > 0
    : Number(form.stopLossUsd) > 0 || Number(form.takeProfitUsd) > 0;
  if (!bandOk) {
    return {
      ok: false,
      message: "Set a USD trigger band on the draft before clear-sign.",
    };
  }

  const log = (msg: string) => opts.onLog?.(msg);
  try {
    log("Connecting Ledger for clear-sign…");
    const sessionId = await ensureLedgerSession();
    log(`Reading Account ${opts.accountIndex + 1}…`);
    const from = await getLedgerEthAddress(sessionId, opts.accountIndex);
    log(`Clear-sign on OLED — review ${form.policyType === 3 ? "buy-dip" : "policy"}…`);
    const result: PolicySignResult = await signAndSendSetGuardianPolicy(
      sessionId,
      GPM_V2,
      from,
      form,
      (e) => log(e.message),
      opts.accountIndex,
    );
    if (result.status === "success") {
      return {
        ok: true,
        txHash: result.txHash,
        from: result.from,
        message: `Policy clear-signed on Ledger — ${result.txHash}`,
      };
    }
    if (result.status === "rejected") {
      return { ok: false, message: "Rejected on Ledger." };
    }
    return { ok: false, message: result.message };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
