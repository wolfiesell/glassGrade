import * as React from 'react'
import { api, type XrpPaymentProposal } from '@/lib/api'

type Action = 'discover' | 'analyze' | 'review' | 'dry-run' | 'send'
export type LiveDecision = {
  decision?: string
  rules?: { status?: string; violations?: string[]; unknowns?: string[] }
  metrics?: {
    historyComplete?: boolean
    firstTimeRecipient?: boolean | null
    senderActivity?: number | null
    recipientActivity?: number | null
    paymentsPerHour?: number | null
    unusualActivity?: boolean | null
    uniqueCounterparties?: number | null
    budgetUtilization?: number | null
    amountDeviation?: number | null
    accountInfo?: {
      senderExists?: boolean | null
      recipientExists?: boolean | null
      senderBalanceXrp?: number | null
      recipientBalanceXrp?: number | null
    }
  }
  jev?: {
    category?: string
    contextualConcern?: string
    contextualRisk?: number
    latencyMs?: number
  } | null
  jevError?: string
}

export function LiveXrplDashboard({ result, onOpenReview }: { result: unknown; onOpenReview: () => void }) {
  if (!result) {
    return (
      <section className="mx-auto w-full max-w-[1200px] rounded-2xl border border-white/10 bg-[#15131c]/90 p-6 text-white sm:p-8">
        <h2 className="text-lg font-semibold">No live review yet</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">Run a live XRPL Testnet review first. This view will show the account activity, history completeness, rules, and Jev response returned by the backend.</p>
        <button type="button" onClick={onOpenReview} className="mt-5 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400">Open XRPL review</button>
      </section>
    )
  }
  return (
    <section className="mx-auto w-full max-w-[1200px] space-y-4 text-white">
      <div className="rounded-2xl border border-white/10 bg-[#15131c]/90 p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Live account insights</h2>
        <p className="mt-1 text-sm text-white/50">Values below are from the most recent successful review in this browser session.</p>
        <button type="button" onClick={onOpenReview} className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10">Review another payment</button>
      </div>
      <LiveResult result={result} />
      <div className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-5 text-sm leading-relaxed text-amber-100/70">
        The live API currently provides XRPL account history, activity metrics, deterministic rule results, and Jev advisory. It does not provide a scam blacklist feed, account-age score, or overall safety grade; those remain unavailable here rather than being guessed.
      </div>
    </section>
  )
}

const actionLabels: Record<Action, string> = {
  discover: 'Discover Ledger accounts',
  analyze: 'Analyze transaction',
  review: 'Review with Jev',
  'dry-run': 'Run dry-run',
  send: 'Send via Ledger',
}

export function LedgerXrpReview({ onLiveResult }: { onLiveResult?: (result: unknown) => void }) {
  const [apiStatus, setApiStatus] = React.useState('Checking API…')
  const [routes, setRoutes] = React.useState<Record<string, string>>({})
  const [sender, setSender] = React.useState('')
  const [account, setAccount] = React.useState('review-only')
  const [recipient, setRecipient] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [budgetLimit, setBudgetLimit] = React.useState('')
  const [budgetSpent, setBudgetSpent] = React.useState('')
  const [destinationTag, setDestinationTag] = React.useState('')
  const [busy, setBusy] = React.useState<Action | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<unknown>(null)

  function sampleProposal() {
    setSender('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh')
    setAccount('review-only')
    setRecipient('rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe')
    setAmount('0.001')
    setBudgetLimit('')
    setBudgetSpent('')
    setDestinationTag('42')
    setResult(null)
    setError(null)
  }

  React.useEffect(() => {
    let active = true
    Promise.all([api.health(), api.serviceInfo()])
      .then(([health, info]) => {
        if (!active) return
        setApiStatus(health.status === 'ok' ? `${info.service} connected` : 'API unavailable')
        setRoutes(info.routes)
      })
      .catch((reason: unknown) => {
        if (active) setApiStatus(reason instanceof Error ? reason.message : 'API unavailable')
      })
    return () => { active = false }
  }, [])

  const proposal: XrpPaymentProposal = {
    network: 'xrp:testnet',
    sender,
    account,
    recipient,
    amount,
    ...(budgetLimit.trim() && budgetSpent.trim() ? {
      budget: { limit: Number(budgetLimit), spent: Number(budgetSpent), currency: 'XRP' as const },
    } : {}),
    ...(destinationTag.trim() ? { destinationTag: Number(destinationTag) } : {}),
  }

  async function run(action: Action) {
    if (action === 'send' && !window.confirm('Send this XRP Testnet payment through Ledger Wallet CLI? Review the exact transaction on your Ledger device before approving.')) return
    const budgetHasOneValue = Boolean(budgetLimit.trim()) !== Boolean(budgetSpent.trim())
    if ((action === 'review' || action === 'analyze') && budgetHasOneValue) {
      setError('Enter both budget values, or leave both blank.')
      return
    }
    if ((action === 'review' || action === 'analyze') && budgetLimit.trim() && budgetSpent.trim() &&
      (!Number.isFinite(Number(budgetLimit)) || Number(budgetLimit) <= 0 || !Number.isFinite(Number(budgetSpent)) || Number(budgetSpent) < 0)) {
      setError('Budget limit must be greater than zero and amount spent must be zero or more.')
      return
    }
    setBusy(action)
    setError(null)
    setResult(null)
    try {
      const value = action === 'discover' ? await api.discoverXrpAccounts()
        : action === 'analyze' ? await api.analyzeTransaction(proposal)
          : action === 'review' ? await api.reviewXrpPayment(proposal)
            : action === 'dry-run' ? await api.dryRunXrpPayment(proposal)
              : await api.sendXrpPayment(proposal)
      setResult(value)
      if (action === 'analyze' || action === 'review') onLiveResult?.(value)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The request failed')
    } finally {
      setBusy(null)
    }
  }

  const proposalReady = Boolean(sender && account && recipient && amount)

  return (
    <section className="mx-auto w-full max-w-[1200px] space-y-5 text-white">
      <div className="rounded-2xl border border-white/10 bg-[#15131c]/90 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Live endpoint connection</h2>
            <p className="mt-1 text-sm text-white/50">API status: {apiStatus}</p>
          </div>
          <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">XRPL Testnet only</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(routes).map(([name, route]) => (
            <span key={name} className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 font-mono text-[11px] text-white/60">{route}</span>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => void run('discover')} disabled={busy !== null} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium hover:bg-white/10 disabled:opacity-50">
            {busy === 'discover' ? 'Connecting…' : actionLabels.discover}
          </button>
          <button type="button" onClick={sampleProposal} disabled={busy !== null} className="rounded-xl border border-violet-300/25 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-400/10 disabled:opacity-50">
            Load Testnet sample
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#15131c]/90 p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Review a proposed payment</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/50">Load the sample or enter a proposed payment. Review and analysis query live XRPL Testnet history and Jev; they do not sign or broadcast. Jev requests may be billable. Add real budget context if you have it; without a budget, the deterministic rules intentionally report insufficient data.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-white/55">Ledger account label<input value={account} onChange={e => setAccount(e.target.value)} placeholder="e.g. testnet-account-1" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" /><span className="block text-[11px] text-white/35">Only needed for Ledger dry-run/send; review uses this field as a label.</span></label>
          <label className="space-y-1.5 text-xs text-white/55">Sender address<input value={sender} onChange={e => setSender(e.target.value)} placeholder="r…" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-violet-400/60" /></label>
          <label className="space-y-1.5 text-xs text-white/55">Recipient address<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="r…" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-violet-400/60" /></label>
          <label className="space-y-1.5 text-xs text-white/55">Amount (XRP)<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.25" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" /></label>
          <label className="space-y-1.5 text-xs text-white/55">XRP budget limit (optional)<input value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} inputMode="decimal" placeholder="e.g. 20" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" /></label>
          <label className="space-y-1.5 text-xs text-white/55">Already spent from budget (optional)<input value={budgetSpent} onChange={e => setBudgetSpent(e.target.value)} inputMode="decimal" placeholder="e.g. 5" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" /></label>
          <label className="space-y-1.5 text-xs text-white/55">Destination tag (optional)<input value={destinationTag} onChange={e => setDestinationTag(e.target.value)} inputMode="numeric" placeholder="42" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" /></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(['analyze', 'review', 'dry-run', 'send'] as const).map(action => (
            <button key={action} type="button" onClick={() => void run(action)} disabled={!proposalReady || busy !== null} className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${action === 'send' ? 'bg-rose-500/80 hover:bg-rose-500' : 'bg-violet-500 hover:bg-violet-400'}`}>
              {busy === action ? 'Working…' : actionLabels[action]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/40">Sending is separate and may broadcast a real Testnet transaction after physical Ledger approval. It is never called automatically.</p>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div> : null}
      {result ? <LiveResult result={result} /> : null}
    </section>
  )
}

export function LiveResult({ result }: { result: unknown }) {
  const response = typeof result === 'object' && result !== null ? result as LiveDecision : null
  const hasDecision = Boolean(response?.decision || response?.rules || response?.metrics || response?.jev)

  return (
    <section aria-label="Live API result" className="rounded-2xl border border-emerald-300/15 bg-[#101913]/90 p-5 sm:p-7">
      {hasDecision ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/60">Review decision · deterministic rules, with Jev advisory separate</p>
              <h2 className="mt-1 text-2xl font-semibold">{response?.decision ?? response?.rules?.status ?? 'Analysis complete'}</h2>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">Rule status: {response?.rules?.status ?? 'unknown'}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="History complete" value={response?.metrics?.historyComplete === true ? 'Yes' : response?.metrics?.historyComplete === false ? 'No · paginated' : 'Unknown'} />
            <Metric label="Sender activity" value={response?.metrics?.senderActivity ?? 'Unknown'} />
            <Metric label="Recipient activity" value={response?.metrics?.recipientActivity ?? 'Unknown'} />
            <Metric label="First-time recipient" value={response?.metrics?.firstTimeRecipient == null ? 'Unknown' : response.metrics.firstTimeRecipient ? 'Yes' : 'No'} />
            <Metric label="Payments per hour" value={response?.metrics?.paymentsPerHour ?? 'Unknown'} />
            <Metric label="Unusual activity" value={response?.metrics?.unusualActivity == null ? 'Unknown' : response.metrics.unusualActivity ? 'Flagged' : 'Not flagged'} />
            <Metric label="Unique counterparties" value={response?.metrics?.uniqueCounterparties ?? 'Unknown'} />
            <Metric label="Budget used" value={response?.metrics?.budgetUtilization == null ? 'Unknown' : `${Math.round(response.metrics.budgetUtilization * 100)}%`} />
            <Metric label="Sender active" value={response?.metrics?.accountInfo?.senderExists == null ? 'Unknown' : response.metrics.accountInfo.senderExists ? 'Yes' : 'No'} />
            <Metric label="Recipient active" value={response?.metrics?.accountInfo?.recipientExists == null ? 'Unknown' : response.metrics.accountInfo.recipientExists ? 'Yes' : 'No'} />
            <Metric label="Sender balance" value={response?.metrics?.accountInfo?.senderBalanceXrp == null ? 'Unknown' : `${response.metrics.accountInfo.senderBalanceXrp} XRP`} />
            <Metric label="Recipient balance" value={response?.metrics?.accountInfo?.recipientBalanceXrp == null ? 'Unknown' : `${response.metrics.accountInfo.recipientBalanceXrp} XRP`} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.04] p-4">
              <h3 className="text-sm font-semibold">Jev advisory</h3>
              {response?.jev ? <p className="mt-2 text-sm text-white/65">{response.jev.category ?? 'Uncategorized'} · {response.jev.contextualConcern ?? 'No concern rating'} · risk {response.jev.contextualRisk ?? '—'}/4 · {response.jev.latencyMs ?? '—'} ms</p> : <p className="mt-2 text-sm text-white/45">{response?.jevError ?? 'No Jev result returned'}</p>}
            </div>
            <div className="rounded-xl bg-white/[0.04] p-4">
              <h3 className="text-sm font-semibold">Rule findings</h3>
              <p className="mt-2 text-sm text-white/65">{response?.rules?.violations?.length ? response.rules.violations.join(' · ') : 'No blocking violations reported.'}</p>
              {response?.rules?.unknowns?.length ? (
                <>
                  <p className="mt-1 text-xs text-amber-200/70">Missing context: {response.rules.unknowns.join(' · ')}</p>
                  {response.rules.unknowns.some(unknown => unknown.toLowerCase().includes('budget')) ? <p className="mt-1 text-xs text-amber-100/60">Enter both budget fields above and rerun to provide this context. Jev did return separately; see its advisory card.</p> : null}
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
      <details className={hasDecision ? 'mt-5 border-t border-white/10 pt-4' : ''}>
        <summary className="cursor-pointer text-xs font-medium text-white/50">{hasDecision ? 'Show raw API response' : 'Show API response'}</summary>
        <pre className="mt-3 max-h-[520px] overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-emerald-100">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 text-lg font-medium text-white">{value}</p>
    </div>
  )
}
