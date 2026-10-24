'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  isLikelyXrplAddress,
  lookupAddress,
  type BlacklistHit,
  type RecipientReport,
  type RiskLevel,
  type SafetySignal,
} from '@/data/mockRecipient'

export type SafetySection =
  | 'overview'
  | 'signals'
  | 'reputation'
  | 'activity'
  | 'lookup'

export interface SafetyBentoProps {
  report: RecipientReport
  onReportChange?: (report: RecipientReport) => void
  title?: string
  subtitle?: string
  embedded?: boolean
  section?: SafetySection
  className?: string
  style?: React.CSSProperties
}

const LEVEL_COLOR: Record<RiskLevel, string> = {
  danger: '#F87171',
  caution: '#C4B5FD',
  safe: '#A1A1AA',
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  danger: 'Warning',
  caution: 'Caution',
  safe: 'Clear',
}

const SCAM_PRIORITY: Record<string, number> = {
  blacklist: 100,
  creation: 90,
  age: 80,
  velocity: 70,
  'balance-share': 60,
  familiarity: 50,
}

function levelBoost(level: RiskLevel) {
  return level === 'danger' ? 30 : level === 'caution' ? 10 : 0
}

function scamRankScore(signal: SafetySignal) {
  return (SCAM_PRIORITY[signal.id] ?? 40) + levelBoost(signal.level) + signal.weight
}

function sortByScamImportance(signals: SafetySignal[]) {
  return [...signals].sort((a, b) => scamRankScore(b) - scamRankScore(a))
}

function signalSpan(rankIndex: number, total: number) {
  if (total <= 2) return 'col-span-12 sm:col-span-6'
  if (rankIndex <= 1) return 'col-span-12 sm:col-span-6'
  const rest = total - 2
  if (rest === 1) return 'col-span-12'
  if (rest === 2) return 'col-span-12 sm:col-span-6'
  if (rest === 3) return 'col-span-12 sm:col-span-4'
  return 'col-span-6 sm:col-span-3'
}

function signalHeight(rankIndex: number, open: boolean) {
  if (open) return rankIndex <= 1 ? 'min-h-[240px] h-auto' : 'min-h-[200px] h-auto'
  return rankIndex <= 1 ? 'h-[180px]' : 'h-[152px]'
}

/** Purple / gray / black gradients only. */
const GRADS = [
  { top: '#c4b5fd', base: '#5b21b6', bottom: '#8b5cf6', core: '#1a0533' },
  { top: '#ddd6fe', base: '#6d28d9', bottom: '#a78bfa', core: '#1e0a3c' },
  { top: '#a78bfa', base: '#4c1d95', bottom: '#7c3aed', core: '#14042a' },
  { top: '#9a9aa8', base: '#3a3a44', bottom: '#55555f', core: '#060608' },
  { top: '#b8b8c0', base: '#2e2e36', bottom: '#4a4a54', core: '#0a0a0c' },
  { top: '#7c7c88', base: '#1f1f24', bottom: '#3a3a42', core: '#050506' },
]

function smoothPath(points: [number, number][], move = true) {
  if (!points.length) return ''
  let d = `${move ? 'M' : 'L'}${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const k = 0.17
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`
  }
  return d
}

function Rim() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[9] rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,.2),inset_0_0_0_1px_rgba(255,255,255,.06)]"
      aria-hidden
    />
  )
}

function GradientBg({
  top,
  base,
  bottom,
  core,
}: {
  top: string
  base: string
  bottom: string
  core: string
}) {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${top} 0%, ${base} 36%, ${base} 74%, ${bottom} 100%)`,
        }}
      />
      <div
        className="absolute top-[16%] right-[10%] bottom-[-6%] left-[10%] rounded-[90px] blur-[60px]"
        style={{ background: core }}
      />
    </>
  )
}

function AddressSearch({
  onLookup,
  onReset,
  canReset,
}: {
  onLookup: (report: RecipientReport) => void
  onReset: () => void
  canReset: boolean
}) {
  const [query, setQuery] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (!isLikelyXrplAddress(q)) {
      setError('Enter a valid XRPL address (starts with r…)')
      return
    }
    const found = lookupAddress(q)
    if (!found) {
      setError('Could not load that address')
      return
    }
    setError(null)
    onLookup(found)
  }

  return (
    <form onSubmit={submit} className="w-full shrink-0">
      <div
        className={cn(
          'flex h-11 items-center gap-2 rounded-2xl border bg-white/[0.06] px-3 transition-colors',
          error
            ? 'border-[#F87171]/50'
            : 'border-white/12 focus-within:border-[#c4b5fd]/55',
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Search XRPL address (r…)"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
          aria-label="Search XRPL address"
        />
        {canReset ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setError(null)
              onReset()
            }}
            className="rounded-lg p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
            aria-label="Clear search and restore Ledger review"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="submit"
          className="rounded-xl bg-[#c4b5fd] px-3 py-1.5 text-[12px] font-semibold text-[#0b0b0c] transition hover:bg-[#d4c8ff]"
        >
          Look up
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-[11.5px] font-medium text-[#F87171]">{error}</p>
      ) : (
        <p className="mt-1.5 text-[11.5px] text-white/30">
          Searched accounts never show a holder name.
        </p>
      )}
    </form>
  )
}

function ScoreHero({ report }: { report: RecipientReport }) {
  const history = report.riskHistory
  const W = 640
  const Hh = 160
  const pad = 20
  const scores = history.map((h) => h.score)
  const mx = Math.max(...scores)
  const mn = Math.min(...scores)
  const X = (i: number) => pad + (i / (history.length - 1)) * (W - pad * 2)
  const Y = (v: number) =>
    pad + (1 - (v - mn) / (mx - mn || 1)) * (Hh - pad * 2)
  const line = smoothPath(history.map((h, i) => [X(i), Y(h.score)]))
  const stroke =
    report.overallLevel === 'danger' ? LEVEL_COLOR.danger : '#c4b5fd'

  return (
    <section
      className="relative col-span-12 h-[320px] overflow-hidden rounded-[24px] lg:col-span-8"
      aria-label="Safety grade"
    >
      <GradientBg {...GRADS[0]} />
      <div className="absolute inset-0 z-[2] flex flex-col p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.06em] text-white/55 uppercase">
              Safety grade
            </div>
            <div className="mt-1.5 flex items-end gap-3">
              <span className="text-[56px] font-extralight leading-none tracking-[-0.05em]">
                {report.grade}
              </span>
              <span
                className="pb-1.5 font-mono text-[13px] font-semibold"
                style={{ color: stroke }}
              >
                {report.overallScore}/100
              </span>
            </div>
          </div>
          <span className="inline-flex h-6 items-center rounded-full bg-black/80 px-2.5 font-mono text-[11px] font-semibold text-white">
            {report.overallLevel === 'danger'
              ? 'High risk'
              : report.overallLevel === 'caution'
                ? 'Elevated'
                : 'Safe'}
          </span>
        </div>

        <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] leading-snug sm:text-[22px]">
          {report.verdict}
        </h2>
        <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/55">
          {report.verdictDetail}
        </p>

        <svg
          className="mt-auto block w-full"
          viewBox={`0 0 ${W} ${Hh}`}
          preserveAspectRatio="none"
          style={{ height: 88 }}
          aria-hidden
        >
          <defs>
            <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line}L${X(history.length - 1)},${Hh}L${X(0)},${Hh}Z`}
            fill="url(#scoreFill)"
          />
          <path
            d={line}
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle
            cx={X(history.length - 1)}
            cy={Y(history[history.length - 1].score)}
            r="4"
            fill={stroke}
            stroke="rgba(0,0,0,.35)"
            strokeWidth="1"
          />
        </svg>
        <div className="mt-1 text-[11px] font-medium text-white/35">
          Risk score · last 14 days
        </div>
      </div>
      <Rim />
    </section>
  )
}

function AccountCard({ report }: { report: RecipientReport }) {
  const { recipient, transaction } = report
  const isSearch = report.source === 'search'

  return (
    <section className="relative col-span-12 h-[320px] overflow-hidden rounded-[24px] lg:col-span-4">
      <GradientBg {...GRADS[5]} />
      <div className="absolute inset-0 z-[2] flex flex-col p-6 sm:p-7">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[16px] font-semibold tracking-[-0.02em]">
            {isSearch ? 'Looked-up account' : 'Recipient'}
          </div>
          <span className="inline-flex h-6 items-center rounded-full bg-white/10 px-2.5 font-mono text-[11px] font-semibold">
            {isSearch ? 'No holder name' : 'From Ledger'}
          </span>
        </div>

        <p className="mt-4 text-[14px] font-semibold">
          {recipient.displayName ?? 'No verified name'}
        </p>
        <code className="mt-2 break-all rounded-xl bg-black/40 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-white/75">
          {recipient.address}
        </code>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold',
              recipient.verified
                ? 'bg-black/50 text-[#c4b5fd]'
                : 'bg-black/50 text-[#f87171]',
            )}
          >
            {recipient.verified ? 'Verified' : 'Unverified'}
          </span>
          <span className="rounded-full bg-black/50 px-2.5 py-1 font-mono text-[11px] text-white/70">
            {recipient.ageDays}d old
          </span>
        </div>

        {transaction ? (
          <div className="mt-auto pt-3">
            <div className="text-[11px] font-semibold tracking-[0.06em] text-white/50 uppercase">
              Signing now
            </div>
            <div className="mt-1 text-[28px] font-extralight tracking-[-0.04em] leading-none tabular-nums">
              {transaction.amountXrp.toLocaleString()}{' '}
              <span className="text-[14px] text-white/50">{transaction.currency}</span>
            </div>
            <div className="mt-2 inline-flex h-6 items-center rounded-full bg-black/80 px-2.5 font-mono text-[11px] font-semibold text-[#f87171]">
              {transaction.percentOfSenderBalance}% of balance
            </div>
          </div>
        ) : (
          <p className="mt-auto pt-3 text-[12.5px] leading-relaxed text-white/45">
            Manual lookup — no pending payment. Holder name is never shown for
            searched addresses.
          </p>
        )}
      </div>
      <Rim />
    </section>
  )
}

function SignalTile({
  signal,
  index,
  rankIndex,
  total,
  open,
  onToggle,
}: {
  signal: SafetySignal
  index: number
  rankIndex: number
  total: number
  open: boolean
  onToggle: () => void
}) {
  const grad = GRADS[index % GRADS.length]
  const useGlass = signal.level === 'safe'
  const color = LEVEL_COLOR[signal.level]
  const large = rankIndex <= 1

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'relative flex overflow-hidden rounded-[24px] text-left transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]',
        open && 'ring-1 ring-white/25',
        signalSpan(rankIndex, total),
        signalHeight(rankIndex, open),
        useGlass && 'border border-white/12 bg-white/[0.06] backdrop-blur-[20px]',
      )}
    >
      {!useGlass ? <GradientBg {...grad} /> : null}
      <div className="relative z-[2] flex w-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-mono text-[11px] font-semibold text-white/35">
              #{rankIndex + 1}
            </span>
            <div className="truncate text-[11px] font-semibold tracking-[0.05em] text-white/55 uppercase">
              {signal.label}
            </div>
          </div>
          <span
            className="inline-flex h-6 shrink-0 items-center rounded-full bg-black/80 px-2.5 font-mono text-[11px] font-semibold"
            style={{ color }}
          >
            {LEVEL_LABEL[signal.level]}
          </span>
        </div>
        <div
          className={cn(
            'mt-auto pt-4 font-extralight tracking-[-0.04em] leading-none tabular-nums text-white',
            large ? 'text-[28px]' : 'text-[22px]',
          )}
        >
          {signal.value}
        </div>
        {open ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">
            {signal.detail}
          </p>
        ) : (
          <p className="mt-3 text-[11px] font-medium text-white/35">
            Click for details
          </p>
        )}
      </div>
      {!useGlass ? <Rim /> : null}
    </button>
  )
}

function ReputationCard({
  hits,
  fullWidth = false,
}: {
  hits: BlacklistHit[]
  fullWidth?: boolean
}) {
  const flagged = hits.some((h) => h.status === 'flagged')
  const [openSource, setOpenSource] = React.useState<string | null>(null)

  return (
    <section
      className={cn(
        'relative col-span-12 h-[300px] overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.06] backdrop-blur-[20px]',
        fullWidth ? 'lg:col-span-12' : 'lg:col-span-6',
        flagged && 'ring-1 ring-[#F87171]/35',
      )}
    >
      <div className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-semibold tracking-[-0.02em]">
            Reputation
          </div>
          <span className="text-[12px] font-medium text-white/35">
            Click a row for details
          </span>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto">
          {hits.map((h, i) => {
            const open = openSource === h.source
            return (
              <button
                key={h.source}
                type="button"
                onClick={() => setOpenSource(open ? null : h.source)}
                aria-expanded={open}
                className={cn(
                  'flex w-full flex-col gap-1 py-3 text-left transition hover:bg-white/[0.03]',
                  i > 0 && 'border-t border-white/10',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-[13px] font-semibold text-white">
                    {h.source}
                  </div>
                  <span
                    className="shrink-0 font-mono text-[11px] font-semibold"
                    style={{
                      color:
                        h.status === 'flagged'
                          ? LEVEL_COLOR.danger
                          : h.status === 'clear'
                            ? LEVEL_COLOR.safe
                            : 'rgba(255,255,255,.45)',
                    }}
                  >
                    {h.status === 'flagged'
                      ? 'Flagged'
                      : h.status === 'clear'
                        ? 'Clear'
                        : 'Unknown'}
                  </span>
                </div>
                {open ? (
                  <p className="text-[12px] leading-relaxed text-white/55">{h.note}</p>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ActivityCard({
  report,
  fullWidth = false,
}: {
  report: RecipientReport
  fullWidth?: boolean
}) {
  const { activity } = report
  const danger = activity.avgTxPerDay > 30
  const vals = activity.dailyOutbound
  const max = Math.max(...vals, 1)
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <section
      className={cn(
        'relative col-span-12 h-[300px] overflow-hidden rounded-[24px]',
        fullWidth ? 'sm:col-span-6 lg:col-span-6' : 'sm:col-span-6 lg:col-span-3',
      )}
    >
      <GradientBg {...GRADS[3]} />
      <div className="absolute inset-0 z-[2] flex flex-col p-5">
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-semibold tracking-[-0.02em]">Activity</div>
          <span className="text-[12px] text-white/50">7d</span>
        </div>
        <div className="mt-3 text-[30px] font-extralight tracking-[-0.04em] leading-none tabular-nums">
          {activity.avgTxPerDay}
          <span className="text-[13px] text-white/50"> tx/day</span>
        </div>
        <div className="mt-1.5 text-[12px] font-medium text-white/50">
          {activity.lastActive}
        </div>

        <div className="mt-auto flex items-end gap-1.5 pt-4" style={{ height: 100 }}>
          {vals.map((v, i) => {
            const h = Math.max(12, (v / max) * 78)
            const hot = i === vals.length - 1
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full max-w-[14px] rounded-full"
                  style={{
                    height: h,
                    background: hot
                      ? danger
                        ? LEVEL_COLOR.danger
                        : '#c4b5fd'
                      : 'rgba(255,255,255,.2)',
                  }}
                />
                <span className="text-[10px] text-white/35">{days[i]}</span>
              </div>
            )
          })}
        </div>
      </div>
      <Rim />
    </section>
  )
}

function FlowCard({
  report,
  fullWidth = false,
}: {
  report: RecipientReport
  fullWidth?: boolean
}) {
  const { activity } = report
  const outboundHeavy = activity.outboundShare >= 70
  return (
    <section
      className={cn(
        'relative col-span-12 h-[300px] overflow-hidden rounded-[24px]',
        fullWidth ? 'sm:col-span-6 lg:col-span-6' : 'sm:col-span-6 lg:col-span-3',
      )}
    >
      <GradientBg {...GRADS[4]} />
      <div className="relative z-[2] flex h-full flex-col p-5">
        <div className="text-[16px] font-semibold tracking-[-0.02em]">Fund flow</div>
        <div className="mt-1 text-[12px] font-medium text-white/50">In vs out</div>
        <div className="mt-auto space-y-5 pb-1">
          {(
            [
              ['Inbound', activity.inboundShare, '#fff'],
              [
                'Outbound',
                activity.outboundShare,
                outboundHeavy ? LEVEL_COLOR.danger : '#c4b5fd',
              ],
            ] as const
          ).map(([label, share, color]) => (
            <div key={label}>
              <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold">
                <span>{label}</span>
                <span className="font-mono">{share}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Rim />
    </section>
  )
}

export function SafetyBento({
  report: initialReport,
  onReportChange,
  title = 'GlassGrade',
  subtitle = 'Opened from Ledger · XRPL clear-sign review',
  embedded = false,
  section = 'overview',
  className,
  style,
}: SafetyBentoProps) {
  const [report, setReport] = React.useState(initialReport)
  const [openSignalId, setOpenSignalId] = React.useState<string | null>(null)
  const ledgerBaseline = React.useRef(initialReport)

  React.useEffect(() => {
    setReport(initialReport)
    setOpenSignalId(null)
    if (initialReport.source === 'ledger') {
      ledgerBaseline.current = initialReport
    }
  }, [initialReport])

  function applyReport(next: RecipientReport) {
    setReport(next)
    setOpenSignalId(null)
    onReportChange?.(next)
  }

  const ranked = sortByScamImportance(report.signals)
  const showHero = section === 'overview' || section === 'lookup'
  const showAccount = section === 'overview' || section === 'lookup'
  const showSignals = section === 'overview' || section === 'signals'
  const showReputation = section === 'overview' || section === 'reputation'
  const showActivity = section === 'overview' || section === 'activity'
  const showSearchBar =
    !embedded || section === 'overview' || section === 'lookup'

  return (
    <div className={cn('w-full text-white antialiased', className)} style={style}>
      <div className={cn('relative text-white', embedded ? 'p-0' : 'rounded-[28px] bg-black p-5 sm:p-7')}>
        {!embedded ? (
          <header className="mb-6 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="m-0">
                <img
                  src="/glassgrade-logo.png"
                  alt={title}
                  className="h-8 w-auto sm:h-9"
                />
              </h1>
              <p className="mt-2 text-[13px] text-white/40">
                {report.source === 'search'
                  ? 'Manual address lookup · no holder name'
                  : subtitle}
              </p>
            </div>
            <AddressSearch
              canReset={report.source === 'search'}
              onLookup={applyReport}
              onReset={() => applyReport(ledgerBaseline.current)}
            />
          </header>
        ) : showSearchBar ? (
          <div className="mb-6 w-full">
            <AddressSearch
              canReset={report.source === 'search'}
              onLookup={applyReport}
              onReset={() => applyReport(ledgerBaseline.current)}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-12 gap-4 sm:gap-5">
          {showHero ? <ScoreHero report={report} /> : null}
          {showAccount ? <AccountCard report={report} /> : null}

          {showSignals
            ? ranked.map((signal, index) => (
                <SignalTile
                  key={signal.id}
                  signal={signal}
                  index={index}
                  rankIndex={index}
                  total={ranked.length}
                  open={openSignalId === signal.id}
                  onToggle={() =>
                    setOpenSignalId((id) =>
                      id === signal.id ? null : signal.id,
                    )
                  }
                />
              ))
            : null}

          {showReputation ? (
            <ReputationCard
              hits={report.blacklists}
              fullWidth={section === 'reputation'}
            />
          ) : null}
          {showActivity ? (
            <>
              <ActivityCard
                report={report}
                fullWidth={section === 'activity'}
              />
              <FlowCard report={report} fullWidth={section === 'activity'} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SafetyBento
