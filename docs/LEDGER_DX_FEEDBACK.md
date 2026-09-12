# Ledger DX Feedback — Ledger Guardian Agent

> Required for Ledger AI Agents × Ledger prize judging.

**Project:** Ledger Guardian Agent (LGA)  
**Event:** ETHOnline 2026  
**Track:** AI Agents × Ledger (Start from Scratch)  
**Repo:** `ledgergaurd`

---

## Summary

| Area | Rating (1–5) | One-line summary |
|---|---|---|
| DMK documentation | 4 | Connect + session model is enough to ship a Vite demo |
| DMK WebHID integration | 4 | Chrome picker works; HID unplug events are reliable |
| Ethereum signer kit | 4 | `signTransaction` + `signMessage` both usable from one builder |
| Key Ring CLI | 4 | Real LKRP encrypt/decrypt path; Windows PATH still thin |
| ERC-7730 / clear signing | 3 | Descriptor JSON is clear; OLED stays raw until registry PR merges |
| Agent skills | 3 | Good pointers, still have to assemble DMK + viem yourself |
| Overall DX | 4 | Physical device path is real; Key Ring on a headless keeper is the missing polished piece |

---

## What worked well

1. Singleton DMK + `webHidTransportFactory` in `packages/hardware-test` — connect once, reuse session for Hello Test and policy txs.
2. Account picker (`m/44'/60'/0'/0/1` Account 2) so the demo never touches the main live account.
3. `SignerEthBuilder.signTransaction` round-trip: encode `setGuardianPolicy` with viem → Ledger approve → `sendRawTransaction` on Base. Proven: `0x89d9ce25007ed4ab4d2b5a0ed39a183c8dba2bd0b23e999059fcf0323098746b`.
4. User-reject (NO / 6985) can be mapped to a calm “rejected” log instead of a stack dump.

---

## Gaps / confusing flows

| Issue | Where | Suggested fix |
|---|---|---|
| Unsigned tx fails with `6a80` / “Invalid data” if the account has 0 Base ETH | `signTransaction` before broadcast | Docs should say: fund the *derived* address first, then sign |
| ERC-7730 labels don’t show on device until registry merge | Ethereum app OLED | Staging/unofficial descriptor load for hackathon demos |
| `wallet-cli ring` not on PATH by default (Windows) | Keeper host | Ship a one-liner in agent-skills: `npm i -g @ledgerhq/wallet-cli` + `ring init` |
| Session key vs master key is easy to mix up | Key Ring + DMK | Explicit: master never leaves device; ring holds *keeper* secret only |
| `killSwitch()` needs a v2 deploy | hardware-test Kill Switch tab | Call out that v1 GPM has no kill function |

---

## Missing context in docs

- Which derivation index Ledger Live labels “Account 2”
- That WebHID is Chrome/Edge desktop only (no Firefox)
- That clear-sign registry PRs lag the hackathon demo by days

---

## Screenshots

| Step | File / description |
|---|---|
| Connect Ledger | hardware-test CONNECTED badge |
| Clear-sign policy | OLED + Basescan policy tx |
| Kill switch | Kill Switch tab → OLED “Revoke ALL…” |
| Key Ring setup | `wallet-cli ring init` / `ring set KEEPER_SESSION_KEY` on keeper host |
| Error encountered | 6a80 before Account 2 had gas |

---

## Suggested improvements (with PRs if any)

- Example recipe: Vite + DMK + viem EIP-1559 (this repo is that recipe).
- Key Ring: `ring get` JSON vs raw string should be documented; keeper `ring.ts` currently trims CLI stdout.
- Allow unsigned ERC-7730 preview in Ethereum app for unpublished descriptors.

---

## Stack used

- [x] `@ledgerhq/device-management-kit`
- [x] `@ledgerhq/device-transport-kit-web-hid`
- [x] `@ledgerhq/device-signer-kit-ethereum`
- [x] `wallet-cli ring` (`packages/keeper/src/ring.ts`)
- [x] Capability broker (`packages/keeper/src/capabilities.ts`) — scoped TTLs; Solver never sees raw keys
- [x] ERC-7730 (`clear-signing/guardian_policy.erc7730.json`, `kill_switch.erc7730.json`)

---

## Capability broker demo (Phase C2)

**Ledger one-liner:** Key Ring holds keeper secrets; the broker hands out scoped capabilities — never the API key / Base session key to Solver or Composer.

### Headless host enroll (no USB at runtime)

```powershell
# Once with Ledger USB
npm i -g @ledgerhq/wallet-cli
WALLET_PASS=… wallet-cli ring init --name lga-keeper-host

cd packages/keeper
# fill secrets.env (KEEPER_SESSION_KEY, GRAPH_*, OPENROUTER_*, Hedera, …)
WALLET_PASS=… npm run ring:enroll
Remove-Item secrets.env

# VPS / Railway: inject WALLET_PASS only
$env:LGA_SECRETS_SOURCE = 'ring'
$env:POLL_MS = '0'
npm start
# GET /health → keyRing.headless=true, capabilityBroker.mode=ring-broker
```

### Scopes

| Scope | Consumer |
|-------|----------|
| `pay:trigger` | Payer (mint then require) · Autopilot / `npm run pay` (in-process **stamp**) |
| `execute:policy:<id>` | Driver `executePolicy` — **`secrets` required** (no skip-by-omission) |
| `read:graph` | Clerk/Solver tools: `queryReceiptGraphNl`, `listActivePolicies`, Messari decide/gate; Autopilot cycle stamp |
| `read:pyth` | Solver `getPythSpot`; Autopilot cycle stamp |

**Honest model:** hot-path caps are a **server stamp** (TTL handle in-process), not a separate agent “request capability” API. Solver/Composer still never see raw session / OpenRouter keys. Expired or missing capability when `mintInternal: false` **fails closed**.

Env fallback (`capabilityBroker.mode=env-broker`) still stamps scopes; prefer `LGA_SECRETS_SOURCE=ring` so `/health.keyRing.headless=true`. Railway with env-only secrets will report `env-broker`.

Proofs: [docs/proofs/phase-c2.md](./proofs/phase-c2.md)

---

## Live demo evidence

- Base mainnet tx: https://basescan.org/tx/0x89d9ce25007ed4ab4d2b5a0ed39a183c8dba2bd0b23e999059fcf0323098746b
- Contract v1: `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103`
- Hardware: Physical Ledger, Account 2 (`m/44'/60'/0'/0/1`)
- Key Ring: keeper decrypts `secrets.env.enc` via `wallet-cli ring decrypt --key lga-keeper` (no `ring get` — official API is encrypt/decrypt)
