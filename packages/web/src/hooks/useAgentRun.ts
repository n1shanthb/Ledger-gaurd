"use client";

import { useCallback, useRef, useState } from "react";
import {
  emptyGraph,
  reduceEvent,
  type AgentEvent,
  type GraphState,
} from "@/lib/agentEvents";

const keeperBase =
  process.env.NEXT_PUBLIC_KEEPER_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:3001";

export function useAgentRun() {
  const [graph, setGraph] = useState<GraphState>(emptyGraph);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setGraph(emptyGraph());
    setErr(null);
    setBusy(false);
  }, []);

  const run = useCallback(async (content: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setErr(null);
    setGraph(emptyGraph());

    try {
      const res = await fetch(`${keeperBase}/agent/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `agent ${res.status}`);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
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
            setGraph((g) => reduceEvent(g, ev));
          } catch {
            /* skip bad frame */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return { graph, busy, err, run, reset, keeperBase };
}
