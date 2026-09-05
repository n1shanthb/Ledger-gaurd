# Ledger DX Feedback — Ledger Guardian Agent

> Required for Ledger AI Agents × Ledger prize judging.
> Fill before submission. Be specific — screenshots and PR links help.

**Project:** Ledger Guardian Agent (LGA)  
**Event:** ETHOnline 2026  
**Track:** AI Agents × Ledger (Start from Scratch)  
**Repo:** `ledgergaurd`

---

## Summary

| Area | Rating (1–5) | One-line summary |
|---|---|---|
| DMK documentation | | |
| DMK WebHID integration | | |
| Ethereum signer kit | | |
| Key Ring CLI | | |
| ERC-7730 / clear signing | | |
| Agent skills | | |
| Overall DX | | |

---

## What worked well

<!-- Example: DMK connect flow, Account 2 derivation, signTransaction for setGuardianPolicy -->

1.
2.
3.

---

## Gaps / confusing flows

<!-- Example: 6a80 Invalid data before gas funding; ERC-7730 not in registry yet -->

| Issue | Where | Suggested fix |
|---|---|---|
| | | |
| | | |

---

## Missing context in docs

<!-- Link to doc pages that were unclear -->

-

---

## Screenshots

<!-- Add paths or embed in submission -->

| Step | File / description |
|---|---|
| Connect Ledger | |
| Clear-sign policy | |
| Key Ring setup | |
| Error encountered | |

---

## Suggested improvements (with PRs if any)

-

---

## Stack used

- [x] `@ledgerhq/device-management-kit`
- [x] `@ledgerhq/device-transport-kit-web-hid`
- [x] `@ledgerhq/device-signer-kit-ethereum`
- [ ] `wallet-cli ring` (planned)
- [x] ERC-7730 descriptor (`clear-signing/guardian_policy.erc7730.json`)

---

## Live demo evidence

- Base mainnet tx: https://basescan.org/tx/0x89d9ce25007ed4ab4d2b5a0ed39a183c8dba2bd0b23e999059fcf0323098746b
- Contract: `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103`
- Hardware: Physical Ledger, Account 2 (`m/44'/60'/0'/0/1`)
