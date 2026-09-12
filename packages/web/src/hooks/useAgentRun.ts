"use client";

import { useCallback, useRef, useState } from "react";
import {
  emptyGraph,
  reduceEvent,
  type AgentEvent,
  type GraphState,
  type PolicyDraft,
} from "@/lib/agentEvents";

const keeperBase =
  process.env.NEXT_PUBLIC_KEEPER_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:3001";

type ChatMsg = { role: "user" | "assistant"; content: string };

async function readSse(
  res: Response,
  onEvent: (ev: AgentEvent) => void,
): Promise<string> {
  if (!res.body) throw new Error("no body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let reply = "";
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
        if (ev.type === "run_end") reply = ev.reply;
      } catch {
        /* skip */
      }
    }
  }
  return reply;
}

export function useAgentRun() {
  const [graph, setGraph] = useState<GraphState>(emptyGraph);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const messagesRef = useRef<ChatMsg[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setGraph(emptyGraph());
    messagesRef.current = [];
    setMessages([]);
    setErr(null);
    setBusy(false);
  }, []);

  const run = useCallback(async (content: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setErr(null);

    const nextMessages: ChatMsg[] = [
      ...messagesRef.current,
      { role: "user", content },
    ];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    try {
      const res = await fetch(`${keeperBase}/agent/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({ messages: nextMessages }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `agent ${res.status}`);
      }

      const reply = await readSse(res, (ev) => {
        setGraph((g) => reduceEvent(g, ev));
      });
      if (reply.trim()) {
        const withAsst: ChatMsg[] = [
          ...messagesRef.current,
          { role: "assistant", content: reply },
        ];
        messagesRef.current = withAsst;
        setMessages(withAsst);
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
  }, []);

  const confirmDraft = useCallback(
    async (draft: PolicyDraft, includeAddons: boolean) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(`${keeperBase}/agent/propose`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
          },
          body: JSON.stringify({ draft, includeAddons }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `propose ${res.status}`);
        }
        const reply = await readSse(res, (ev) => {
          setGraph((g) => reduceEvent(g, ev));
        });
        if (reply.trim()) {
          const withAsst: ChatMsg[] = [
            ...messagesRef.current,
            { role: "assistant", content: reply },
          ];
          messagesRef.current = withAsst;
          setMessages(withAsst);
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
    [],
  );

  const setPolicyDraft = useCallback((draft: PolicyDraft | null) => {
    setGraph((g) => ({ ...g, policyDraft: draft }));
  }, []);

  return {
    graph,
    busy,
    err,
    run,
    reset,
    confirmDraft,
    setPolicyDraft,
    messages,
    keeperBase,
  };
}
