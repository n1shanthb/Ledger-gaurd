"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyGraph,
  reduceEvent,
  withDraftStatus,
  type AgentAction,
  type AgentEvent,
  type Evidence,
  type GraphState,
  type PolicyDraft,
  type PolicyDraftItem,
  type StrategyType,
  type UiState,
} from "@/lib/agentEvents";

const keeperBase =
  process.env.NEXT_PUBLIC_KEEPER_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:3001";

const CHAT_KEY = "lga.agent.chat.v1";
const FORM_KEY = "lga.agent.form.v1";
const SIGNED_KEY = "lga.agent.signedTx.v1";

type ChatMsg = { role: "user" | "assistant"; content: string };

export type PolicySuggestion = {
  draft: PolicyDraft;
  cta: string;
  evidence: Evidence[];
};

function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

function applyActionToForm(
  formDraft: PolicyDraft | null,
  action: AgentAction,
): {
  formDraft: PolicyDraft | null;
  suggestion: PolicySuggestion | null;
  evidence: Evidence[] | null;
} {
  switch (action.type) {
    case "open_form":
      return {
        formDraft: action.payload.draft,
        suggestion: null,
        evidence: null,
      };
    case "patch_form": {
      if (!formDraft) return { formDraft, suggestion: null, evidence: null };
      const primary: PolicyDraftItem = {
        ...formDraft.primary,
        ...action.payload.patch,
      };
      return {
        formDraft: withDraftStatus({ ...formDraft, primary }),
        suggestion: null,
        evidence: null,
      };
    }
    case "show_evidence":
      return {
        formDraft,
        suggestion: null,
        evidence: action.payload.evidence,
      };
    case "suggest_policy":
      return {
        formDraft,
        suggestion: {
          draft: action.payload.draft,
          cta: action.payload.cta,
          evidence: action.payload.evidence,
        },
        evidence: action.payload.evidence,
      };
    default:
      return { formDraft, suggestion: null, evidence: null };
  }
}

async function readSse(
  res: Response,
  onEvent: (ev: AgentEvent) => void,
): Promise<{ reply: string; action: AgentAction }> {
  if (!res.body) throw new Error("no body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let reply = "";
  let action: AgentAction = { type: "none" };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const chunks = buf.split("\n\n");
    buf = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        const ev = JSON.parse(raw) as AgentEvent;
        onEvent(ev);
        if (ev.type === "run_end") {
          reply = ev.reply;
          action = ev.action ?? { type: "none" };
        }
      } catch {
        /* skip */
      }
    }
  }
  return { reply, action };
}

export function useAgentRun() {
  const [graph, setGraph] = useState<GraphState>(emptyGraph);
  const [formDraft, setFormDraft] = useState<PolicyDraft | null>(null);
  const [suggestion, setSuggestion] = useState<PolicySuggestion | null>(null);
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [signedTx, setSignedTx] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const messagesRef = useRef<ChatMsg[]>([]);
  const formDraftRef = useRef<PolicyDraft | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore chat + form after refresh / accidental remount (post clear-sign must not look wiped)
  useEffect(() => {
    const msgs = loadJson<ChatMsg[]>(CHAT_KEY);
    const draft = loadJson<PolicyDraft>(FORM_KEY);
    const tx = loadJson<string>(SIGNED_KEY);
    if (msgs?.length) {
      messagesRef.current = msgs;
      setMessages(msgs);
    }
    if (draft?.primary) {
      formDraftRef.current = draft;
      setFormDraft(draft);
    }
    if (typeof tx === "string" && tx.startsWith("0x")) setSignedTx(tx);
    setHydrated(true);
  }, []);

  const syncForm = useCallback((draft: PolicyDraft | null) => {
    formDraftRef.current = draft;
    setFormDraft(draft);
    saveJson(FORM_KEY, draft);
  }, []);

  const syncMessages = useCallback((msgs: ChatMsg[]) => {
    messagesRef.current = msgs;
    setMessages(msgs);
    saveJson(CHAT_KEY, msgs);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setGraph(emptyGraph());
    syncForm(null);
    setSuggestion(null);
    setEvidence(null);
    setSignedTx(null);
    saveJson(SIGNED_KEY, null);
    syncMessages([]);
    setErr(null);
    setBusy(false);
  }, [syncForm, syncMessages]);

  const uiStateFromForm = useCallback((): UiState => {
    const d = formDraftRef.current;
    return {
      formOpen: d != null,
      formKind: (d?.primary.strategyType as StrategyType | undefined) ?? null,
      draft: d?.primary ?? null,
    };
  }, []);

  const run = useCallback(
    async (content: string) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      setErr(null);
      setSuggestion(null);
      setEvidence(null);

      const nextMessages: ChatMsg[] = [
        ...messagesRef.current,
        { role: "user", content },
      ];
      syncMessages(nextMessages);

      try {
        const res = await fetch(`${keeperBase}/agent/run`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: nextMessages,
            uiState: uiStateFromForm(),
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `agent ${res.status}`);
        }

        const { reply, action } = await readSse(res, (ev) => {
          setGraph((g) => reduceEvent(g, ev));
        });

        const applied = applyActionToForm(formDraftRef.current, action);
        syncForm(applied.formDraft);
        setSuggestion(applied.suggestion);
        setEvidence(applied.evidence);

        if (reply.trim()) {
          syncMessages([
            ...messagesRef.current,
            { role: "assistant", content: reply },
          ]);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : String(e);
        setErr(
          /failed to fetch|networkerror|load failed/i.test(msg)
            ? `Keeper unreachable at ${keeperBase} — start packages/keeper (POLL_MS=0 npm start)`
            : msg,
        );
      } finally {
        setBusy(false);
      }
    },
    [syncForm, syncMessages, uiStateFromForm],
  );

  const confirmDraft = useCallback(
    async (
      draft: PolicyDraft,
      _includeAddons: boolean,
      opts?: { accountIndex?: number },
    ) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      setErr(null);
      // Keep draft visible the whole time — never clear on sign
      syncForm(draft);
      try {
        const { clearSignPolicyDraft } = await import("@/lib/clearSignDraft");
        const accountIndex = opts?.accountIndex ?? 1;
        const result = await clearSignPolicyDraft({
          draft,
          accountIndex,
          onLog: (msg) => {
            if (
              !/Ledger|OLED|approved|broadcast|Account|Connecting|Clear-sign|capped|Auto-approve|Waiting/i.test(
                msg,
              )
            ) {
              return;
            }
            const last = messagesRef.current[messagesRef.current.length - 1];
            if (
              last?.role === "assistant" &&
              /Ledger|OLED|Waiting|Clear-sign|Connecting|Account/i.test(
                last.content,
              ) &&
              last.content.length < 400
            ) {
              syncMessages([
                ...messagesRef.current.slice(0, -1),
                { role: "assistant", content: `${last.content}\n${msg}` },
              ]);
              return;
            }
            syncMessages([
              ...messagesRef.current,
              { role: "assistant", content: msg },
            ]);
          },
        });
        if (ac.signal.aborted) return;
        if (result.ok) {
          setSignedTx(result.txHash);
          saveJson(SIGNED_KEY, result.txHash);
          syncMessages([
            ...messagesRef.current,
            {
              role: "assistant",
              content: `${result.message}\nMaster key never left Ledger. Draft stays open — check Activity for indexing.`,
            },
          ]);
          return result;
        }
        setErr(result.message);
        syncMessages([
          ...messagesRef.current,
          { role: "assistant", content: result.message },
        ]);
        return result;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
      } finally {
        setBusy(false);
      }
    },
    [syncForm, syncMessages],
  );

  const setPolicyDraft = useCallback(
    (draft: PolicyDraft | null) => {
      syncForm(draft);
    },
    [syncForm],
  );

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    syncForm(suggestion.draft);
    setSuggestion(null);
    setEvidence(null);
  }, [suggestion, syncForm]);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
    setEvidence(null);
  }, []);

  return {
    graph,
    formDraft,
    suggestion,
    evidence,
    signedTx,
    busy,
    err,
    run,
    reset,
    confirmDraft,
    setPolicyDraft,
    acceptSuggestion,
    dismissSuggestion,
    messages,
    hydrated,
    keeperBase,
  };
}
