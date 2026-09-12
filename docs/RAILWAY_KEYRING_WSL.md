# Deferred — Railway Key Ring via WSL (post-demo)

**When:** after demo video. **Not required** for hackathon submit if local keeper already shows ring decrypt + Railway runs on env vars.

**Goal:** `/health` on Railway shows `keyRing.source=ring`, `headless=true` (Linux ring decrypt in Docker).

**Why deferred:** `secrets.env.enc` alone is not enough. Railway Linux container also needs ring init state (session + OS keychain member key). Windows ring init does not carry over automatically.

---

## What already works (skip if fine for judges)

| Surface | Ring | Notes |
|---------|------|--------|
| Local keeper (`npm start`) | ✅ | `ring keys: 20`, `OpenRouter: enrolled` |
| Railway keeper | env fallback | x402 + `PAY_ON_HIT=1` work; `headless=false` |

Demo pitch: *Key Ring on laptop; encrypted blob in repo; headless keeper on Railway for x402.*

---

## Part A — Fix WSL (you)

### A1. Reboot

Full Windows restart (WSL had `Catastrophic failure` / read-only apt).

### A2. Repair Ubuntu

Normal PowerShell:

```powershell
wsl --update
wsl --shutdown
wsl -d Ubuntu echo ok
```

Expect: `ok`

**Still broken?** Reinstall distro:

```powershell
wsl --unregister Ubuntu
wsl --install Ubuntu --no-launch
wsl -d Ubuntu
```

Set Linux username/password on first launch, then:

```powershell
wsl -d Ubuntu echo ok
```

### A3. usbipd (Admin PowerShell)

Right-click PowerShell → **Run as administrator** → approve UAC:

```powershell
winget install dorssel.usbipd-win --accept-package-agreements --accept-source-agreements
```

### A4. Ready message for agent

When A2 prints `ok` and usbipd installed, reply in chat:

```text
wsl ok — continue ring setup
```

Agent takes over from Part B.

---

## Part B — Agent setup (after `wsl ok`)

1. Install in Ubuntu: `libsecret-1-0`, `gnome-keyring`, `dbus-x11`, Node 22, `@ledgerhq/wallet-cli`
2. Attach Ledger USB to WSL (Admin PowerShell):

```powershell
usbipd list
usbipd bind --busid <BUSID>          # once per device
usbipd attach --wsl --busid <BUSID>   # each session
```

3. In WSL: `lsusb | grep -i ledger` — must show device

---

## Part C — Ledger sign (you)

**When:** agent runs `wallet-cli ring init --name lga-keeper-host`

**Before command:**

- Ledger plugged in, unlocked
- **Ethereum app** open on device

**On device:** approve the Key Ring provisioning prompt (one sign).

Use same password as Windows enroll:

```bash
export WALLET_PASS='your-ring-password'
wallet-cli ring init --name lga-keeper-host
```

---

## Part D — Verify decrypt (agent)

```bash
cd /mnt/e/ledgergaurd/packages/keeper
wallet-cli ring decrypt --key lga-keeper -i secrets.env.enc -o /tmp/secrets.env
grep -E '^[A-Z_]+=' /tmp/secrets.env | cut -d= -f1
rm /tmp/secrets.env
```

Expect ~20 keys (`KEEPER_SESSION_KEY`, `OPENROUTER_API_KEY`, …).

---

## Part E — Railway (agent + you)

1. Export Linux ring state (local only, never commit):

```bash
tar -czf ~/ring-state.tgz -C ~/.local/state ledger-wallet-cli
tar -czf ~/ring-keyring.tgz -C ~/.local/share keyrings
```

2. Dockerfile bootstrap: copy state into `/root/.local/…`, install libsecret, entrypoint starts dbus/keyring
3. Railway vars:

```text
LGA_SECRETS_SOURCE=ring
LGA_RING_KEY=lga-keeper
WALLET_PASS=<same as ring init>
POLL_MS=0
PAY_ON_HIT=1
```

4. Remove duplicate plaintext vars (`KEEPER_SESSION_KEY`, `OPENROUTER_API_KEY`, …) after ring decrypt works
5. Redeploy → check:

```bash
curl -s https://lga-keeper-production.up.railway.app/health
```

Want: `"source":"ring","headless":true`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Catastrophic failure` | Reboot; reinstall Ubuntu (A2) |
| `Key Ring not initialized` | Run Part C (`ring init`) with Ledger |
| `Wrong password` | `WALLET_PASS` must match ring init exactly |
| No Ledger in WSL | usbipd attach (B2); Admin install (A3) |
| apt read-only in WSL | Reboot; `wsl --unregister Ubuntu` + reinstall |

---

## Windows ring (already done)

```powershell
cd e:\ledgergaurd\packages\keeper
$env:WALLET_PASS = '…'
npm run ring:export
npm run ring:enroll
Remove-Item secrets.env
npm start
```

Do **not** pipe `wallet-cli ring decrypt` through PowerShell `$plain = …` or `Out-File` — use `npm run ring:export` (Node UTF-8).
