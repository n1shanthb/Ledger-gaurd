/** Soften agent replies — plain text + structured chips for addresses / JSON. */

const URL_RE = /https?:\/\/\S+/gi;
const HCS_RE = /hcs:\/\/\S+/gi;
const ADDR_RE = /0x[a-fA-F0-9]{40}/g;
const JSON_RE = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;

export type ChatBlock =
  | { kind: "text"; text: string }
  | { kind: "address"; address: string; label?: string }
  | { kind: "json"; label: string; value: Record<string, unknown> };

export function stripAgentJargon(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/^_gate\s+/gim, "Gate ")
    .replace(/_/g, "")
    .replace(URL_RE, "")
    .replace(HCS_RE, "")
    .replace(/\b(attemptId|capability|cap_[a-z0-9-]+|Qm[A-Za-z0-9]{20,})\b/gi, "")
    .replace(/^(Clerk|Solver|Payer|Driver|Policy intake)\s*[—:-]\s*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Pull addresses + JSON into UI blocks; leave a short prose summary. */
export function parseChatBlocks(raw: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let rest = raw;
  const jsonHits: { start: number; end: number; obj: Record<string, unknown> }[] =
    [];

  let m: RegExpExecArray | null;
  const jsonRe = new RegExp(JSON_RE.source, "g");
  while ((m = jsonRe.exec(raw)) !== null) {
    const obj = tryParseJson(m[0]);
    if (obj && Object.keys(obj).length > 0) {
      jsonHits.push({ start: m.index, end: m.index + m[0].length, obj });
    }
  }

  // Walk string, emit text / json in order
  let cursor = 0;
  const addrsSeen = new Set<string>();

  const flushText = (slice: string) => {
    let t = stripAgentJargon(slice);
    // pull addresses out of prose into boxes
    const found = [...t.matchAll(ADDR_RE)].map((x) => x[0]);
    for (const a of found) {
      if (addrsSeen.has(a.toLowerCase())) {
      t = t.split(a).join("").trim();
        continue;
      }
      addrsSeen.add(a.toLowerCase());
      const parts = t.split(a);
      const before = parts[0]?.trim();
      if (before) blocks.push({ kind: "text", text: before });
      const label =
        /contract/i.test(before ?? "") || /PAYMENT_AUDIT|audit/i.test(before ?? "")
          ? "Contract"
          : "Address";
      blocks.push({ kind: "address", address: a, label });
      t = parts.slice(1).join(a).trim();
    }
    t = t.replace(/\s{2,}/g, " ").trim();
    if (t) blocks.push({ kind: "text", text: t });
  };

  if (jsonHits.length === 0) {
    flushText(rest);
  } else {
    for (const hit of jsonHits) {
      if (hit.start > cursor) flushText(raw.slice(cursor, hit.start));
      const label =
        "contract" in hit.obj
          ? "Bridge"
          : "attemptId" in hit.obj
            ? "Payment"
            : "Details";
      // Prefer address box from contract field
      const contract = hit.obj.contract;
      if (typeof contract === "string" && /^0x[a-fA-F0-9]{40}$/i.test(contract)) {
        addrsSeen.add(contract.toLowerCase());
        blocks.push({
          kind: "address",
          address: contract,
          label: "PaymentAudit contract",
        });
        const { contract: _c, ...restObj } = hit.obj;
        if (Object.keys(restObj).length > 0) {
          blocks.push({ kind: "json", label, value: restObj });
        }
      } else {
        blocks.push({ kind: "json", label, value: hit.obj });
      }
      cursor = hit.end;
    }
    if (cursor < raw.length) flushText(raw.slice(cursor));
  }

  // If nothing left but jargon, one short line
  if (blocks.length === 0) {
    blocks.push({
      kind: "text",
      text: stripAgentJargon(raw).slice(0, 200) || "Done.",
    });
  }

  return blocks;
}

export function clipUserReply(raw: string, maxChars = 420): string {
  const s = stripAgentJargon(raw);
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const at = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("\n"));
  return `${(at > 100 ? cut.slice(0, at + 1) : cut).trim()}…`;
}

export function formatAssistantBubble(raw: string): {
  preview: string;
  detail: string | null;
  blocks: ChatBlock[];
} {
  const blocks = parseChatBlocks(raw);
  const prose = blocks
    .filter((b): b is Extract<ChatBlock, { kind: "text" }> => b.kind === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const clean = prose || stripAgentJargon(raw);
  if (clean.length <= 220 && blocks.every((b) => b.kind === "text")) {
    return { preview: clean, detail: null, blocks };
  }
  const preview = clipUserReply(clean || "See details below.", 200);
  return {
    preview,
    detail: clean.length > 220 ? clean : null,
    blocks,
  };
}
