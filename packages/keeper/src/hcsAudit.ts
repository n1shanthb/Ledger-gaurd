import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction,
  AccountId,
} from "@hashgraph/sdk";
import type { KeeperSecrets } from "./ring";

export async function submitHcsMemo(
  secrets: KeeperSecrets,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const topicId = process.env.HCS_TOPIC_ID || secrets.hcsTopicId;
  if (!topicId) {
    console.log("[lga] HCS_TOPIC_ID unset — skip HCS memo");
    return null;
  }
  if (!secrets.hederaAccountId) return null;

  try {
    const net = secrets.hederaNetwork === "hedera:mainnet" ? "mainnet" : "testnet";
    const client =
      net === "mainnet" ? Client.forMainnet() : Client.forTestnet();
    client.setOperator(
      AccountId.fromString(secrets.hederaAccountId),
      PrivateKey.fromStringECDSA(secrets.sessionKey),
    );
    const msg = JSON.stringify(payload);
    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(msg)
      .execute(client);
    const receipt = await tx.getReceipt(client);
    const seq = receipt.topicSequenceNumber?.toString() ?? "?";
    const ref = `hcs://${topicId}/${seq}`;
    console.log(`[lga] HCS memo ${ref}`);
    client.close();
    return ref;
  } catch (e) {
    console.warn("[lga] HCS memo failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export function hcsHashscanUrl(
  network: KeeperSecrets["hederaNetwork"],
  hcsRef: string | null,
): string | null {
  if (!hcsRef?.startsWith("hcs://")) return null;
  const parts = hcsRef.replace("hcs://", "").split("/");
  const topicId = parts[0];
  if (!topicId) return null;
  const net = network === "hedera:mainnet" ? "mainnet" : "testnet";
  return `https://hashscan.io/${net}/topic/${topicId}`;
}
