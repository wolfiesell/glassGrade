import * as React from 'react'
import { api, type QrTransactionRequest } from '@/lib/api'
import { LiveResult, type LiveDecision } from '@/components/ledger-xrp-review'

type QrReviewResponse = LiveDecision & {
  proposal?: { sender: string; recipient: string; amount: string; destinationTag?: number }
  transaction?: { amountDrops: string; feeDrops?: string; sequence?: number }
  requestId?: string
}

type QrRequestState = { value?: QrTransactionRequest; error?: string }

function readQrRequest(): QrTransactionRequest {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const tx = params.get('tx')
  const net = params.get('net')
  const code = params.get('code') ?? undefined
  if (!tx) throw new Error('This QR link does not contain a transaction.')
  if (net !== 'testnet') throw new Error('Only XRPL Testnet QR requests are supported.')
  return { tx, net, ...(code ? { code } : {}) }
}

export function QrTransactionReview() {
  const [request] = React.useState<QrRequestState>(() => {
    try { return { value: readQrRequest() } }
    catch (error) { return { error: error instanceof Error ? error.message : 'Invalid QR link.' } }
  })
  const [result, setResult] = React.useState<QrReviewResponse | null>(null)
  const [error, setError] = React.useState<string | null>(request.error ?? null)
  const [loading, setLoading] = React.useState(Boolean(request.value))
  const reviewPromise = React.useRef<Promise<unknown> | null>(null)

  React.useEffect(() => {
    if (!request.value) return
    const promise = reviewPromise.current ??= api.reviewQrTransaction(request.value)
    let active = true
    promise
      .then(value => { if (active) setResult(value as QrReviewResponse) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not review this QR transaction.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request.value])

  return (
    <main className="min-h-svh bg-[#09090b] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-white/10 bg-[#15131c]/90 p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">GlassGrade · QR transaction review</p>
          <h1 className="mt-2 text-2xl font-semibold">XRPL Testnet payment</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">The QR proposal is sent to the backend for XRPL history analysis and a separate Jev advisory. This review does not sign or broadcast.</p>
        </header>

        {loading ? <div role="status" className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white/65">Reviewing the payment against XRPL Testnet and Jev…</div> : null}
        {error ? <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</div> : null}

        {result ? (
          <>
            <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#15131c]/90 p-5 sm:grid-cols-2 sm:p-7">
              <Detail label="From" value={result.proposal?.sender ?? '—'} />
              <Detail label="To" value={result.proposal?.recipient ?? '—'} />
              <Detail label="Amount" value={`${result.proposal?.amount ?? '—'} XRP`} />
              <Detail label="Destination tag" value={result.proposal?.destinationTag ?? 'None'} />
              <Detail label="Fee" value={result.transaction?.feeDrops ? `${result.transaction.feeDrops} drops` : 'Not supplied'} />
              {result.requestId ? <Detail label="Review request" value={result.requestId} /> : null}
            </section>
            <LiveResult result={result} />
          </>
        ) : null}
      </div>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 break-all font-mono text-sm text-white/85">{value}</p>
    </div>
  )
}
