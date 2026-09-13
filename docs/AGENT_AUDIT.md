# LGA Agent Room — Audit

**Date:** 2026-09-13  
**Scope:** What the six agents are, what each can access, how chat routes work, and what users can (and cannot) expect today.  
**Code changes:** none — documentation only.

---

## 1. Executive snapshot

| Fact | Reality today |
|---|---|
| How many agents? | **Six** named roles in UI + SSE |
| How many are LLMs? | **Three** — Composer, Solver, Clerk (OpenRouter) |
| How many are code workers? | **Three** — Payer, Autopilot, Driver (no chat model) |
| Can chat set an on-chain policy alone? | **No** — drafts only; user clear-signs on Ledger |
| Can agents see Ledger balances? | **Not via keeper tools.** Web UI reads balances after Connect; Agent draft form can show balance if address is already known in the browser |
| Can agents see policy history? | **Yes, via Receipt Graph** (Clerk) — studio-indexed policies / receipts / payment audits (global index unless filtered in UI) |
| Why `hi` sometimes hits 429? | Studio **free-tier rate limit**, often because the running keeper still routes small-talk into Graph/pay paths, or Railway is on an older build |

**Copy rule:** Master key never leaves Ledger. Key Ring holds keeper secrets.

---

## 2. Trust model (who is allowed to do what)

```text
User (Ledger OLED)
  └─ clear-signs policy / session / kill     ← only path that moves authority

Browser (packages/web)
  ├─ reads balances (RPC) after USB connect
  ├─ Agent room chat → keeper /agent/run
  └─ Policy draft card → confirm → propose SSE (still no broadcast)

Keeper (packages/keeper)
  ├─ Composer / Solver / Clerk  → OpenRouter + scoped tools
  ├─ Payer                      → Hedera x402 pay → POST /trigger
  ├─ Autopilot                  → poll / pay-on-hit (background)
  └─ Driver                     → session-key executePolicy on Base when bands hit

External data
  ├─ Receipt Graph (Subgraph Studio)  → policies, fills, payment audits
  ├─ Pyth                             → spots / VAAs for execute
  └─ Messari fan-out (@lga/graph-data)→ lending util / pool depth gate
```

**Hard boundaries**

- LLM never holds the session key in chat replies.
- LLM never broadcasts a Guardian tx.
- Fill requires on-chain Pyth update + GPM trigger check — payment alone is not a fill.
- Kill / policy create require physical Ledger confirmation.

---

## 3. The six agents

### 3.1 Composer (AI)

| | |
|---|---|
| **Job** | Classify the latest user message into a **pipeline**, and run **policy intake** when the user wants a new protection |
| **Model** | OpenRouter (`composer`, typically gpt-4o-mini) |
| **Tools (intake)** | `getPythSpot` (to seed draft bands); `proposeGuardianPolicy` path via intake (draft JSON only) |
| **Does not** | Pay x402, execute fills, invent balances, claim Ledger signed |

**Pipelines it chooses**

| Pipeline | Meaning | Who runs next |
|---|---|---|
| `status` | What’s active / receipts / payments | Clerk |
| `risk` | Explain / compare risk | Solver (+ code gate) |
| `execute` | Explicit pay / trigger now | Gate + **Payer** (no long Solver essay in current design) |
| `propose` | Draft a protection for clear-sign | Policy intake → draft card in UI |
| `full` | Vague / chitchat | Should be talk-only; must not pay |

---

### 3.2 Clerk (AI)

| | |
|---|---|
| **Job** | Answer **status** questions from live Receipt Graph |
| **Model** | OpenRouter (`clerk`) |
| **Tools** | `queryReceiptGraphNl` (Subgraph MCP consumer → Studio), `getRecentPayments` (keeper in-memory x402 attempts) |
| **Sees** | Indexed policies, execution receipts, payment audits (HCS / Hedera refs when present); recent paid attempts in keeper memory |
| **Does not** | See USB Ledger balances; pay; fill; clear-sign |

**Useful asks**

- “What policies are active?”
- “Any recent fills / receipts?”
- “Who paid / any HCS payment audits?”

**Caveat:** Graph queries are **Studio-wide** unless the NL query or UI filters by owner. Chat does **not** automatically scope to “my Ledger address” unless the question (or future wiring) includes it.

---

### 3.3 Solver (AI)

| | |
|---|---|
| **Job** | Explain market / borrow / depth risk in plain language |
| **Model** | OpenRouter (`solver`) |
| **Tools** | `getPythSpot`, `compareLendingRisk`, `findDeepestWethPool` |
| **Gate** | Code-first `evaluateSwapGate` (Messari decide) runs **in process** before/alongside risk; Solver must not re-call it |
| **Does not** | Pay, fill, or draft OLED txs |

**Useful asks**

- “Explain buy-dip vs stop-loss”
- “Is USDC borrow looking stressed on Base?”
- “Any depth concern for a WETH exit?”

---

### 3.4 Payer (worker — not an LLM)

| | |
|---|---|
| **Job** | Spend HBAR via x402 and call keeper `POST /trigger` |
| **Triggered by** | Chat pipeline `execute`, or Autopilot pay-on-hit |
| **Access** | Hedera payment credentials from Key Ring; capability broker `pay:trigger` |
| **Result** | Payment attempt + cycle evaluation. **Not** a fill by itself |

---

### 3.5 Autopilot (worker — not an LLM)

| | |
|---|---|
| **Job** | Background watch: Hermes/Pyth spot vs clear-signed bands; when in range, pay and attempt execute |
| **Access** | Receipt Graph active policies, Pyth, Key Ring session path via Driver |
| **User-facing** | Runs while monitoring after unplug — not a chat personality |

---

### 3.6 Driver (worker — not an LLM)

| | |
|---|---|
| **Job** | On Base: push Pyth VAA + `executePolicy` with session key when GPM says triggered |
| **Access** | Session key (Key Ring), GPM, Pyth, Uniswap path inside executor |
| **User-facing** | Fill txs show in Activity / Basescan — chat only reports honesty (“payment ≠ fill”) |

---

## 4. What chat can do for the user (journeys)

### A. Draft a new policy (set protection)

1. User: “Protect my ETH if it dumps” / buy-dip / take-profit  
2. Composer → `propose` → policy intake  
3. UI shows **Policy draft** (editable; Agent page can show **Available** balance + MAX if Ledger address already in browser from Protect)  
4. User **Confirm for Ledger clear-sign**  
5. OLED confirm → on-chain policy  
6. Agents **do not** broadcast this without the device  

### B. Answer questions (status / history)

1. User asks about active policies, fills, payments  
2. Composer → `status` → Clerk → Receipt Graph (+ optional recent payments)  
3. Answer should be short and graph-backed  

### C. Risk / education

1. User asks explain / compare / risk  
2. Composer → `risk` → Solver (+ Messari/Pyth tools)  
3. No pay  

### D. Paid evaluation / trigger

1. User **explicitly** asks to pay / run `/trigger` / paid evaluation  
2. Composer → `execute` → gate → Payer → `/trigger`  
3. Driver may fill **only if** a policy is in-band on-chain  
4. Chat must say payment ≠ fill  

### E. Small talk (`hi`)

1. **Intended:** warm reply only — **no Graph, no pay**  
2. **Bug you hit:** older/misrouted runs still called Clerk/Solver/Payer → Studio **429**  

---

## 5. Data access matrix

| Data | Web Protect UI | Composer | Clerk | Solver | Payer | Autopilot | Driver |
|---|---|---|---|---|---|---|---|
| Ledger ETH/ERC20 **balances** | Yes (after connect) | No tool | No | No | No | No | No (uses allowances/on-chain as needed for fill) |
| Live Pyth spot | Yes (API) | Intake spot | — | Yes | — | Yes (trigger) | Yes (VAA) |
| Active policies (Graph) | Yes | — | Yes | — | Via cycle | Yes | Via execute |
| Execution receipts / fills | Activity | — | Yes | — | — | — | Creates fill |
| Payment / HCS audits | Activity / Agent payments list | — | Yes | — | Creates pay memos | Creates pay | — |
| Session key | Never in UI | Never | Never | Never | Capability mint | Uses pay path | Uses key for Base tx |
| Messari lending/DEX | Research / compose | — | — | Yes | Gate only | Gate on execute | — |

### Balances — important gap

- **Balances live in the browser** after “Open wallet” on Protect (`fetchHoldings`).  
- **Keeper chat tools have no `getBalance` / no Ledger address injection** into Clerk/Solver.  
- Policy draft MAX buttons work when `ProtectionProvider.ledgerAddress` is set — that is **UI**, not the LLM “seeing” the wallet.  
- Intake is instructed **never invent balances**.

### Policy history — partial

- Clerk can answer from **Receipt Graph** (policies, receipts, audits).  
- Default Graph lists are **not strictly “my wallet only”** unless the question or a future owner filter says so.  
- Web Activity filters by connected address when present.

---

## 6. Secrets & capabilities

| Secret / capability | Where | Who uses it |
|---|---|---|
| `OPENROUTER_API_KEY` | Key Ring | Composer, Solver, Clerk |
| `SUBGRAPH_QUERY_URL` + `GRAPH_API_KEY` | Key Ring | Clerk, Autopilot cycle, pay `/trigger` policy fetch |
| Hedera pay creds / Blocky402 | Key Ring | Payer, Autopilot pay-on-hit |
| Base session key | Key Ring | Driver execute |
| `pay:trigger` capability | Broker in keeper | Payer / Autopilot |

Light Hedera agent identity (roster + `agent=` tags) names **which worker** spent pay — not full HCS-14 DIDs for all six.

---

## 7. Failure modes (what you just saw)

| Symptom | Cause | Not the cause |
|---|---|---|
| `subgraph 429` / “rate limit” | **The Graph Studio free-tier quota** after too many Clerk/cycle queries | Ledger, Pyth, or “AI being evil” |
| `hi` → Clerk + Solver + 429 box | Message still entered **status/risk/execute** path (old deploy or sticky history classify) | User’s hardware |
| Payment / eval, fills 0 | Paid `/trigger` with **no policy in band** or Graph fetch failed | Expected honesty — payment ≠ fill |
| Long Solver “1. ETH Price…” | Model ignoring brevity; UI clips with Show more | |

---

## 8. Intended vs missing product capabilities

| Capability | Status |
|---|---|
| Chat → draft policy → Ledger clear-sign | **Works** (propose + draft card) |
| Chat → status from Receipt Graph | **Works** (Clerk) when Studio is healthy |
| Chat → risk explain | **Works** (Solver) |
| Chat → paid trigger | **Works** when user asks explicitly and Studio/Hermes healthy |
| Chat sees **this user’s** balances | **Gap** — UI only; agents not wired to holdings |
| Chat auto-scopes Graph to connected owner | **Gap** — mostly global Studio reads |
| Autopilot unplug-and-fill story | **Works** on keeper (near-band + Hermes gate) |
| Friendly `hi` with zero Graph | **Intended in local tree**; verify **running** keeper build (local restart / Railway redeploy) |

---

## 9. How to use Agent room (operator cheat sheet)

| You want… | Say / do |
|---|---|
| New protection | “Draft a stop-loss for ETH…” → edit draft → Confirm → Ledger |
| Amount from wallet | Connect on Protect first → draft Amount MAX |
| Status | “What policies are active for me?” (name your address if possible) |
| Risk | “Explain buy-dip vs stop-loss for USDC on hand” |
| Paid check | Explicit: “Run a paid /trigger…” — then wait if Studio 429’d |
| Just chat | `hi` — should **not** spend Graph quota |

---

## 10. Audit conclusion

LGA’s agents are a **pipeline of specialists with hard trust boundaries**, not one omniscient chatbot:

- **LLMs advise and draft**; **Ledger signs**; **workers pay and fill**.  
- **Policy history** is available through **Receipt Graph** (Clerk).  
- **Balances** are a **Protect-wallet UI** concern today — agents do **not** securely “see” the Ledger portfolio in chat tools.  
- The **429** pain is **Studio quota + over-eager Graph calls**, compounded when small-talk still fans into Clerk/Solver/Payer.

**Highest-value follow-ups (for a later code pass, not this doc):** wire owner + optional holdings into Clerk/intake; guarantee greetings never touch Graph on every deploy; owner-scoped Graph questions by default.
