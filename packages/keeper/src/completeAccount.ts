import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TransferTransaction,
} from "@x402/hedera";
import { loadSecrets } from "./ring";

const secrets = loadSecrets();
const id = secrets.hederaAccountId;
if (!id) throw new Error("HEDERA_ACCOUNT_ID missing from Key Ring / env");

const account = AccountId.fromString(id);
const client =
  secrets.hederaNetwork === "hedera:testnet"
    ? Client.forTestnet().setOperator(account, PrivateKey.fromStringECDSA(secrets.sessionKey))
    : Client.forMainnet().setOperator(account, PrivateKey.fromStringECDSA(secrets.sessionKey));

const rx = await new TransferTransaction()
  .addHbarTransfer(account, Hbar.fromTinybars(-1))
  .addHbarTransfer(account, Hbar.fromTinybars(1))
  .execute(client)
  .then((r) => r.getReceipt(client));

console.log("[lga] hollow account complete", String(rx.status));
client.close();
