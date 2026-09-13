"use client";

import { FundGasQr } from "@/components/FundGasQr";
import { PolicyLevelField } from "@/components/PolicyLevelField";
import { PolicyPriceChart } from "@/components/PolicyPriceChart";
import { AgentCompanionRail } from "@/components/protect/AgentCompanionRail";
import { JourneyStepper } from "@/components/protect/JourneyStepper";
import { SystemReadiness } from "@/components/protect/SystemReadiness";
import { Button } from "@/components/ui/Button";
import { EmptyState, Panel, StatusBanner } from "@/components/ui/Panel";
import { ACCOUNTS, useProtectJourney } from "@/hooks/useProtectJourney";
import { BASE_TOKENS } from "@/lib/abi";
import type { Address } from "viem";

const field =
  "mt-1.5 w-full border border-mist bg-ink/40 px-3 py-2.5 text-sm text-paper outline-none focus:border-signal";
const labelCls = "block text-xs font-medium text-mute";

export function ProtectJourney() {
  const j = useProtectJourney();

  if (j.readOnlyMobile && !j.connected) {
    return (
      <div className="mt-6 space-y-4">
        <SystemReadiness hidOk={j.hidOk} ledgerConnected={false} />
        <EmptyState
          title="Signing needs desktop Ledger"
          body="Mobile is read-only for monitoring and activity. Open LGA on Chrome or Edge with your USB Ledger to clear-sign protections."
          action={
            <Button
              variant="secondary"
              onClick={() => j.goStage("monitor")}
            >
              Continue to monitoring tips
            </Button>
          }
        />
        <AgentCompanionRail stage={j.stage} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <JourneyStepper
          stage={j.stage}
          onJump={(s) => {
            if (s === "device" || j.connected || s === "monitor" || s === "outcome") {
              j.goStage(s);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-5 pb-5">
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute hover:text-signal"
            onClick={() => j.setMode(j.mode === "demo" ? "live" : "demo")}
          >
            {j.mode} mode
          </button>
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-kill/80 hover:text-kill"
            onClick={() => {
              j.setKillAck(false);
              j.goStage("kill");
            }}
          >
            Kill switch
          </button>
        </div>
      </div>

      <SystemReadiness
        hidOk={j.hidOk}
        ledgerConnected={j.connected}
      />

      <AgentCompanionRail stage={j.stage} />

      {!j.hidOk && (
        <StatusBanner tone="danger" title="WebHID unavailable">
          Use Chrome or Edge on desktop with a USB Ledger.
        </StatusBanner>
      )}

      {j.needsGas && j.ledgerAddress && (
        <FundGasQr address={j.ledgerAddress} />
      )}

      {j.stage === "device" && (
        <Panel>
          <h2 className="font-display text-2xl tracking-tight text-paper">
            Device readiness
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mute">
            One step: unlock Ledger, open the Ethereum app, then connect.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {j.conn.status !== "connected" ? (
              <Button
                onClick={() => void j.handleConnect()}
                disabled={j.conn.status === "connecting" || !j.hidOk}
              >
                {j.conn.status === "connecting" ? "Connecting…" : "Connect Ledger"}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => void j.handleDisconnect()}>
                Disconnect
              </Button>
            )}
            <select
              className={`${field} !mt-0 w-auto min-w-[10rem]`}
              value={j.accountIndex}
              onChange={(e) => j.setAccountIndex(Number(e.target.value))}
              aria-label="Ledger account"
            >
              {ACCOUNTS.map((a) => (
                <option key={a.index} value={a.index}>
                  {a.label}
                  {j.mode === "demo" && a.index === 1 ? " · demo default" : ""}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!j.connected || j.holdingsLoading}
              onClick={() => void j.readAddressAndBalances()}
            >
              {j.holdingsLoading ? "Loading…" : "Read balances"}
            </Button>
          </div>
          {j.ledgerAddress && (
            <p className="mt-3 font-mono text-xs text-mute">{j.ledgerAddress}</p>
          )}
          {j.connected && (
            <div className="mt-4">
              <Button
                variant="secondary"
                disabled={j.busy}
                onClick={() => void j.runPrep()}
              >
                {j.phase === "session"
                  ? "Confirm session on Ledger…"
                  : "Enable keeper session (once)"}
              </Button>
              {j.sessionEnabled && (
                <p className="mt-2 text-xs text-signal">Session key enabled.</p>
              )}
            </div>
          )}
        </Panel>
      )}

      {j.stage === "asset" && (
        <Panel>
          <h2 className="font-display text-xl text-paper">Choose an asset</h2>
          <p className="mt-1 text-sm text-mute">
            Live Pyth spots when the feed responds. USDC is for buy-dip spend only.
          </p>
          {j.holdingsErr && (
            <p className="mt-3 text-sm text-kill">{j.holdingsErr}</p>
          )}
          {j.holdings.length === 0 && !j.holdingsLoading && (
            <EmptyState
              title="No balances yet"
              body="Go back and read balances from Ledger, or refresh after funding gas."
              action={
                <Button variant="secondary" onClick={() => j.goStage("device")}>
                  Back to device
                </Button>
              }
            />
          )}
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {j.holdings.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={h.id === "usdc"}
                  onClick={() => j.protectAsset(h)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left transition hover:bg-signal/[0.03] disabled:opacity-40"
                >
                  <div>
                    <p className="font-display text-xl text-paper">{h.symbol}</p>
                    <p className="mt-1 font-mono text-xs text-mute">
                      {h.balanceOk ? h.balanceFormatted : "?"}
                      {h.spotUsd != null && ` · $${h.spotUsd.toFixed(2)}`}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
                    {h.id === "usdc" ? "Buy-dip only" : "Protect →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {j.stage === "strategy" && (
        <Panel>
          <h2 className="font-display text-xl text-paper">Choose protection</h2>
          <p className="mt-1 text-sm text-mute">
            What should happen when price crosses your limit?
          </p>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {(
              [
                { t: 0 as const, title: "Stop loss", body: "Sell if price falls to your floor." },
                { t: 1 as const, title: "Take profit", body: "Sell if price rises to your target." },
                { t: 3 as const, title: "Buy dip", body: "Spend USDC when ETH is at or below entry." },
              ] as const
            ).map((s) => (
              <li key={s.t}>
                <button
                  type="button"
                  onClick={() => j.setStrategy(s.t)}
                  className="flex w-full flex-col gap-1 py-6 text-left transition hover:bg-signal/[0.03] sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span className="font-display text-2xl text-paper">{s.title}</span>
                  <span className="max-w-sm text-sm text-mute">{s.body}</span>
                </button>
              </li>
            ))}
          </ul>
          <details className="mt-6 border-t border-line pt-4">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
              Experimental · LP bounds
            </summary>
            <p className="mt-2 text-sm text-mute">
              LP exit behavior is not fully productized yet. Use only if you understand
              the on-chain band.
            </p>
            <Button
              className="mt-3"
              variant="ghost"
              onClick={() => j.setStrategy(2)}
            >
              Use LP bounds
            </Button>
          </details>
        </Panel>
      )}

      {j.stage === "limits" && (
        <Panel>
          <h2 className="font-display text-xl text-paper">Protection limits</h2>
          <p className="mt-1 text-sm text-mute">
            Amount, threshold, slippage. Demo presets are labeled — Live stays custom.
          </p>

          {j.mode === "demo" && (
            <div className="mt-6 border-l-2 border-warn/50 pl-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-warn">
                Demo · unplug then fill
              </p>
              <p className="mt-2 max-w-xl text-sm text-mute">
                Clear-sign a stop slightly under spot, unplug Ledger, let Autopilot watch.
                Keeper only pays when <span className="text-paper">Hermes is in-band</span> and
                agrees with on-chain Pyth within ~2% — GPM still requires a real on-chain
                trigger (no soft fills above the stop).
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="success" onClick={() => void j.applyNearBandWatch()}>
                  Near-band watch (−$5)
                </Button>
                <Button variant="secondary" onClick={() => void j.applyBuyDip()}>
                  Buy-dip in range
                </Button>
              </div>
              <details className="mt-3 text-xs text-mute">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider">
                  Technical · already-in-range presets
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={j.applyInstantFill}>
                    Stop above spot
                  </Button>
                  <Button variant="ghost" onClick={() => void j.applyPythBand()}>
                    Spot + $10
                  </Button>
                </div>
              </details>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {(j.form.policyType === 0 || j.form.policyType === 2) && (
                <PolicyLevelField
                  label={j.form.policyType === 2 ? "Bottom sell" : "Stop-loss"}
                  hint="Sell when Pyth hits this floor."
                  side="loss"
                  value={j.form.stopLossUsd}
                  onChange={(stopLossUsd) => j.setForm((f) => ({ ...f, stopLossUsd }))}
                  asset={j.chartAsset}
                />
              )}
              {(j.form.policyType === 1 || j.form.policyType === 2) && (
                <PolicyLevelField
                  label={j.form.policyType === 2 ? "Top take" : "Take-profit"}
                  hint="Sell when Pyth hits this target."
                  side="profit"
                  value={j.form.takeProfitUsd}
                  onChange={(takeProfitUsd) =>
                    j.setForm((f) => ({ ...f, takeProfitUsd }))
                  }
                  asset={j.chartAsset}
                />
              )}
              {j.form.policyType === 3 && (
                <PolicyLevelField
                  label="Buy if ETH ≤"
                  hint="Spend USDC at or below this."
                  side="buy-low"
                  value={j.form.stopLossUsd}
                  onChange={(stopLossUsd) => j.setForm((f) => ({ ...f, stopLossUsd }))}
                  asset="eth"
                />
              )}
              <label className={labelCls}>
                {j.form.policyType === 3 ? "USDC to spend" : "Max amount"}
                <div className="mt-1.5 flex gap-2">
                  <input
                    className={`${field} !mt-0 flex-1`}
                    value={j.form.maxAmount}
                    onChange={(e) =>
                      j.setForm((f) => ({ ...f, maxAmount: e.target.value }))
                    }
                  />
                  <select
                    className={`${field} !mt-0 !w-28`}
                    value={j.form.maxAmountUnit}
                    disabled={j.form.policyType === 3}
                    onChange={(e) =>
                      j.setForm((f) => ({
                        ...f,
                        maxAmountUnit: e.target.value as "eth" | "token" | "usdc",
                      }))
                    }
                  >
                    {j.form.policyType === 3 ? (
                      <option value="usdc">USDC</option>
                    ) : (
                      <>
                        <option value="eth">ETH</option>
                        <option value="token">Token</option>
                      </>
                    )}
                  </select>
                </div>
              </label>
              <label className={labelCls}>
                Max slippage (%)
                <input
                  className={field}
                  value={j.form.maxSlippagePercent}
                  onChange={(e) =>
                    j.setForm((f) => ({
                      ...f,
                      maxSlippagePercent: e.target.value,
                    }))
                  }
                />
              </label>
              <Button onClick={() => j.goStage("review")}>Continue to review</Button>
            </div>
            {j.ledgerAddress && (
              <PolicyPriceChart
                asset={j.chartAsset}
                stopLossUsd={j.form.stopLossUsd}
                takeProfitUsd={j.form.takeProfitUsd}
                policyType={j.form.policyType}
              />
            )}
          </div>
        </Panel>
      )}

      {j.stage === "review" && (
        <Panel>
          <h2 className="font-display text-xl text-paper">Safety review</h2>
          <p className="mt-1 text-sm text-mute">
            What can move, what cannot, and what you will clear-sign.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mute">
            <li>
              <span className="text-paper">Can move:</span> only the max amount of the
              selected asset within your price band and slippage.
            </li>
            <li>
              <span className="text-paper">Cannot move:</span> master key, unrelated
              tokens, or amounts above the clear-signed max.
            </li>
            <li>
              <span className="text-paper">Session key:</span>{" "}
              {j.sessionEnabled
                ? "enabled for keeper fills"
                : "not enabled yet — enable on Device step"}
            </li>
          </ul>
          <div className="mt-6 border border-line bg-panel/50 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal">
              OLED preview
            </p>
            <dl className="mt-3 space-y-2">
              {j.oledRows.map((r) => (
                <div
                  key={r.label}
                  className="flex justify-between gap-4 border-b border-line/60 pb-2 text-sm"
                >
                  <dt className="text-mute">{r.label}</dt>
                  <dd className="font-mono text-paper">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {j.mode === "live" && (
            <label className="mt-4 flex items-start gap-2 text-sm text-mute">
              <input
                type="checkbox"
                className="mt-1"
                checked={j.limitsAck}
                onChange={(e) => j.setLimitsAck(e.target.checked)}
              />
              I reviewed limits and understand Live mode has no instant-trigger shortcuts.
            </label>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => j.goStage("limits")}>
              Edit limits
            </Button>
            <Button
              variant="success"
              disabled={j.mode === "live" && !j.limitsAck}
              onClick={() => void j.submitPolicy()}
            >
              Clear-sign on Ledger
            </Button>
          </div>
        </Panel>
      )}

      {j.stage === "signing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-6">
          <div className="max-w-md text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-signal">
              Confirm on device
            </p>
            <h2 className="mt-4 font-display text-4xl tracking-tight text-paper">
              Waiting on Ledger
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-mute">
              Scroll the OLED preview, then approve. Reject to return to review.
            </p>
            <p className="mt-8 font-mono text-xs text-mute" aria-live="polite">
              {j.phase === "signing" ? "Signing…" : "Finishing…"}
            </p>
          </div>
        </div>
      )}

      {j.stage === "monitor" && (
        <div className="space-y-4">
          {j.safeUnplug && (
            <StatusBanner tone="success" title="Safe to disconnect Ledger">
              Policy is on-chain. Keeper can evaluate without USB. We watch Receipt Graph
              for a fill — payments alone are not fills.
            </StatusBanner>
          )}
          <Panel>
            <h2 className="font-display text-xl text-paper">Monitoring</h2>
            <p className="mt-1 text-sm text-mute">
              Keeper:{" "}
              {j.keeperHealth ?? "unavailable — monitoring paused until reachable"}
            </p>
            {j.watchingFills && !j.fillNotice && (
              <p className="mt-3 font-mono text-xs text-warn">
                Watching for indexed fill…
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={j.startWatching}>
                Start watching
              </Button>
              <Button
                disabled={j.paidAttemptBusy || !j.keeperHealth}
                onClick={() => void j.runPaidAttempt()}
              >
                {j.paidAttemptBusy ? "Requesting…" : "Run paid attempt"}
              </Button>
              <Button variant="ghost" onClick={() => j.goStage("device")}>
                Back to device
              </Button>
            </div>
            {j.paidAttemptMsg && (
              <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-ink/50 p-3 text-xs text-mute">
                {j.paidAttemptMsg}
              </pre>
            )}
            <details className="mt-4 text-xs text-mute">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-2 font-mono">
                CLI: npm run pay:on-hit · keeper {j.keeperBase} · GPM{" "}
                <input
                  className={`${field} mt-2 font-mono text-xs`}
                  value={j.contractAddress}
                  onChange={(e) => j.setContractAddress(e.target.value.trim())}
                />
              </p>
            </details>
          </Panel>
        </div>
      )}

      {(j.stage === "outcome" ||
        ((j.fillNotice || j.killConfirmed) &&
          j.stage !== "kill" &&
          j.stage !== "signing" &&
          j.stage !== "review" &&
          j.stage !== "limits")) && (
          <div className="space-y-4">
            {j.killConfirmed && (
              <StatusBanner tone="danger" title="All protections stopped">
                Kill switch confirmed on-chain
                {j.lastKillTx && (
                  <>
                    {" · "}
                    <a
                      href={`https://basescan.org/tx/${j.lastKillTx}`}
                      className="text-kill underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Basescan
                    </a>
                  </>
                )}
                . Indexed kill events appear on Activity after Graph catches up.
              </StatusBanner>
            )}
            {j.fillNotice && (
              <Panel>
                <h2 className="font-display text-xl text-paper">Fill outcome</h2>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-mute">Trigger</dt>
                    <dd>{j.fillNotice.trigger}</dd>
                  </div>
                  <div>
                    <dt className="text-mute">Pyth / fill</dt>
                    <dd className="font-mono">
                      {j.fillNotice.pyth} / {j.fillNotice.fill}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-mute">Compliant</dt>
                    <dd className={j.fillNotice.compliant ? "text-signal" : "text-kill"}>
                      {j.fillNotice.compliant ? "yes" : "no"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-mute">Tx</dt>
                    <dd>
                      <a
                        className="font-mono text-xs text-accent hover:underline"
                        href={`https://basescan.org/tx/${j.fillNotice.tx}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {j.fillNotice.tx.slice(0, 12)}…
                      </a>
                    </dd>
                  </div>
                </dl>
              </Panel>
            )}
            {!j.fillNotice && !j.killConfirmed && j.stage === "outcome" && (
              <EmptyState
                title="No fill indexed yet"
                body="Payment or evaluation may have run without an execution. Check Activity — Driver only reports actual fills."
                action={
                  <Button variant="secondary" onClick={() => j.goStage("monitor")}>
                    Back to monitoring
                  </Button>
                }
              />
            )}
          </div>
        )}

      {j.stage === "kill" && (
        <Panel>
          <h2 className="font-display text-2xl tracking-tight text-kill">
            Emergency kill
          </h2>
          <p className="mt-2 text-sm text-mute">
            This clear-signs killSwitch() and stops all protections for this owner.
            Requires Ledger confirmation.
          </p>
          <label className="mt-4 flex items-start gap-2 text-sm text-mute">
            <input
              type="checkbox"
              className="mt-1"
              checked={j.killAck}
              onChange={(e) => j.setKillAck(e.target.checked)}
            />
            I understand this is destructive and must be signed on Ledger.
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => j.goStage("monitor")}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!j.connected || !j.killAck || j.busy}
              onClick={() => void j.submitKill()}
            >
              {j.phase === "kill" ? "Confirm on Ledger…" : "Clear-sign kill"}
            </Button>
          </div>
        </Panel>
      )}

      <details className="rounded-xl border border-line bg-panel/40 p-3">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-mute">
          Technical details · device log
        </summary>
        <label className={`${labelCls} mt-3`}>
          Token (advanced)
          <select
            className={field}
            value={j.form.token}
            disabled={j.form.policyType === 3}
            onChange={(e) => {
              const token = e.target.value as Address;
              const isBtc =
                token.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase();
              j.setForm((f) => ({
                ...f,
                token,
                maxAmountUnit: isBtc ? "token" : "eth",
              }));
            }}
          >
            <option value={BASE_TOKENS.WETH}>ETH (WETH)</option>
            <option value={BASE_TOKENS.CBBTC}>BTC (cbBTC)</option>
            <option value={BASE_TOKENS.cbETH}>cbETH</option>
          </select>
        </label>
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto font-mono text-[11px]">
          {j.logs.length === 0 && <li className="text-mute">No events yet.</li>}
          {j.logs.map((l) => (
            <li
              key={l.id}
              className={
                l.level === "error"
                  ? "text-kill"
                  : l.level === "success"
                    ? "text-signal"
                    : l.level === "warn"
                      ? "text-warn"
                      : "text-mute"
              }
            >
              <span className="opacity-60">{l.ts}</span> {l.message}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
