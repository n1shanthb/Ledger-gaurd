# x402 settle proof (Hedera)

Live paid `POST /trigger` against the **public** keeper (`POLL_MS=0`, `poll.mode=x402_only`).

**Keeper URL:** `https://lga-keeper-production.up.railway.app`  
**Facilitator:** Blocky402 testnet (`https://api.testnet.blocky402.com`)  
**Network:** `hedera:testnet`

---

## Unpaid (B1)

```bash
curl -i -X POST "https://lga-keeper-production.up.railway.app/trigger" \
  -H "content-type: application/json" -d "{}"
```

**Captured 2026-09-12 UTC:**

```text
HTTP/1.1 402 Payment Required
Content-Type: application/json; charset=utf-8
payment-required: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xnYS1rZWVwZXItcHJvZHVjdGlvbi51cC5yYWlsd2F5LmFwcC90cmlnZ2VyIiwiZGVzY3JpcHRpb24iOiJMR0Ega2VlcGVyIGZ1bGwgZXhlY3V0aW9uIGF0dGVtcHQiLCJtaW1lVHlwZSI6ImFwcGxpY2F0aW9uL2pzb24ifSwiYWNjZXB0cyI6W3sic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiaGVkZXJhOnRlc3RuZXQiLCJhbW91bnQiOiIxMDAwMDAiLCJhc3NldCI6IjAuMC4wIiwicGF5VG8iOiIwLjAuODAxMTUxMCIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7ImZlZVBheWVyIjoiMC4wLjcxNjI3ODQifX1dfQ==

{}
```

Decoded `payment-required` (accepts):

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://lga-keeper-production.up.railway.app/trigger",
    "description": "LGA keeper full execution attempt"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "hedera:testnet",
      "amount": "100000",
      "asset": "0.0.0",
      "payTo": "0.0.8011510",
      "maxTimeoutSeconds": 300,
      "extra": { "feePayer": "0.0.7162784" }
    }
  ]
}
```

---

## Paid (B2)

```bash
WALLET_PASS=… LGA_SECRETS_SOURCE=ring \
  KEEPER_URL=https://lga-keeper-production.up.railway.app/trigger \
  npm run pay
```

| Field | Value |
|---|---|
| Date (UTC) | 2026-09-12T09:02:04Z |
| Keeper URL | `https://lga-keeper-production.up.railway.app` |
| HTTP status | **200** |
| `attemptId` | `att_mty5ow0x_78bqpa` |
| Hedera settle tx | `0.0.7162784@1789203702.106539865` |
| HashScan | [testnet tx](https://hashscan.io/testnet/transaction/0.0.7162784%401789203702.106539865) |
| Payer account | `0.0.10364129` |
| HCS ref | `hcs://0.0.10423816/1` |
| Base fill tx | none (`evaluated:0` — no active policy in band) |
| Studio | `https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4` |

Redacted keeper log / body (no private keys):

```text
[lga] pay status 200
[lga] pay body {"attemptId":"att_mty5ow0x_78bqpa","evaluated":0,"executed":[],"skips":[],"hcsRef":"hcs://0.0.10423816/1","hcsTopicUrl":"https://hashscan.io/testnet/topic/0.0.10423816","mcp":"Subgraph MCP → https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4 — …"}
[lga] payment-response {"success":true,"payer":"0.0.10364129","transaction":"0.0.7162784@1789203702.106539865","network":"hedera:testnet"}
```

`/payments/recent` confirms the same `attemptId`.

---

## Modes

- Prize: `poll.mode = x402_only` (`POLL_MS=0`) — verified on `/health`
- Dev laptop only: `POLL_MS=30000` (not for Hedera demo)
