import type { KeeperSecrets } from "../ring";
import type { Emit, RunResult, UiState } from "./types";
import { orchestrate } from "./orchestrate";

/** JSON-friendly entry (and used by SSE runner). */
export async function agentChat(
  secrets: KeeperSecrets,
  userMessages: { role: "user" | "assistant"; content: string }[],
  emit?: Emit,
  uiState?: UiState | null,
): Promise<RunResult> {
  return orchestrate({ secrets, userMessages, emit, uiState });
}
