# Ledger Guardian Agent (LGA)

> Hardware-bounded DeFi exits — Ledger clear-sign · Receipt Graph · x402 keeper · Key Ring secrets.

**ETHOnline pool:** **Start Fresh** (net-new) — not Continuity.  
**Graph prize pitch:** Best AI **Use Case** agent/app — Receipt Graph is load-bearing for keeper decisions (not a tooling MCP product).

## What It Does

1. **Clear-signed exit policy** — LP stop-loss floor and/or take-profit target on Ledger OLED (ERC-7730).
2. **Key Ring secrets** — keeper loads session key + API creds via `wallet-cli ring`, not `.env`.
3. **Receipt Graph** — live Subgraph on Base indexes policies + compliance receipts.
4. **Keeper automation** — polls Graph + Pyth, decides trigger, executes on Base.
5. **x402 gate** — same process **hosts** gated `POST /trigger` and **pays** as Payer/Autopilot (Blocky402 on Hedera).
6. **Kill switch** — one Ledger-signed tx revokes all delegation.

---

## Architecture

```
Ledger (DMK + Key Ring setup) → Guardian Vault (Base)
                                      ↑
Receipt Graph (The Graph Studio) ← Keeper Agent
                                      ↑
                              Hedera x402 (Blocky402)
                              Pyth (live prices)

Host:     POST /trigger (402 unpaid → settle → execute)
Consumer: Payer · Autopilot pay-on-hit · npm run pay
```

**Docs:** [ANCHOR.md](./docs/ANCHOR.md) · [ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [HACKATHON.md](./docs/HACKATHON.md) · [x402 settle proof](./docs/proofs/x402-settle.md)

---

## Live proof (Base mainnet)

| | |
|---|---|
| Contract | `0x53C25a50B2f40EF8bFD3d673ec667cCB912af103` |
| Ledger tx | [0x89d9ce25…](https://basescan.org/tx/0x89d9ce25007ed4ab4d2b5a0ed39a183c8dba2bd0b23e999059fcf0323098746b) |
| Demo app | `packages/hardware-test` |

---

## Quick Start

```bash
# Skills
npx skills add ledgerhq/agent-skills
npx skills add graphprotocol/subgraphs-skills
npx skills add hedera-dev/hedera-skills

# Hardware demo (works today)
cd packages/hardware-test && npm install && npm run dev

# Protocol frontend
cd packages/web && npm install && npm run dev

# Full stack (build during hackathon)
cd packages/subgraph && graph deploy --studio ledger-guardian-agent
cd packages/keeper && pnpm start   # x402 /trigger
```

---

## Project Structure

```
ledgergaurd/
├── packages/
│   ├── web/             Series A protocol frontend (Next.js)
│   ├── hardware-test/   Ledger DMK demo (live)
│   ├── contracts/       GuardianPolicyManager + v2 roadmap
│   ├── subgraph/        Receipt Graph → Subgraph Studio
│   └── keeper/          Subgraph MCP + x402 + Key Ring
├── clear-signing/       ERC-7730 descriptors
└── docs/
    ├── HACKATHON.md     ← prize requirements matrix
    └── LEDGER_DX_FEEDBACK.md
```

---

## License

MIT
