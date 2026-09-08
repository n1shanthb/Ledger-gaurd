# x402 settle proof (Hedera)

Fill after one live paid `POST /trigger` against the **public** keeper (`POLL_MS=0`).

## Unpaid

```bash
curl -i -X POST "$KEEPER_URL/trigger" -H "content-type: application/json" -d "{}"
```

Expected: **HTTP 402** Payment Required (Blocky402 / Hedera accept).

Paste status line:

```text
HTTP/1.1 402 …
```

## Paid

```bash
WALLET_PASS=… KEEPER_URL=$KEEPER_URL/trigger npm run pay
```

| Field | Value |
|---|---|
| Date (UTC) | |
| Keeper URL | |
| HTTP status | |
| `attemptId` | |
| HashScan | |
| Base fill tx (if any) | |
| Studio receipt query | |

Paste redacted `PAYMENT-RESPONSE` / body (no private keys):

```text
(paste)
```

## Modes

- Prize: `poll.mode = x402_only`
- Dev laptop only: `POLL_MS=30000` (not for Hedera demo)
