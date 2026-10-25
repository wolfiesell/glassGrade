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

const ACCENT = '#8B5CF6'
const ACCENT_SOFT = '#A78BFA'

const LEVEL_COLOR: Record<RiskLevel, string> = {
  danger: '#F87171',
  caution: ACCENT_SOFT,
  safe: '#A1A1AA',
}

/** Shared tile sizes — variety via orientation, not random heights. */
const H_HERO = 'h-[280px]'
const H_METRIC = 'h-[148px]'
const RADIUS = 'rounded-2xl'
/** Opaque panel fills with slight unique purple gradients. */
const PANEL_GRADS = [
  'linear-gradient(152deg, #2c2542 0%, #18151f 52%, #121018 100%)',
  'linear-gradient(168deg, #32284a 0%, #16131c 48%, #100e16 100%)',
  'linear-gradient(142deg, #292240 0%, #1a1624 55%, #12101a 100%)',
  'linear-gradient(160deg, #2e2650 0%, #17141f 50%, #0f0d14 100%)',
  'linear-gradient(148deg, #2a2344 0%, #19151f 46%, #111018 100%)',
  'linear-gradient(175deg, #31274c 0%, #15131c 58%, #0e0c14 100%)',
]

/** Slightly lifted fills — for cards sitting on the bright mist. */
const RAISED_GRADS = [
  'linear-gradient(155deg, #3a3158 0%, #221c32 50%, #181422 100%)',
  'linear-gradient(165deg, #3f3560 0%, #241e36 52%, #1a1526 100%)',
  'linear-gradient(148deg, #383054 0%, #201a30 48%, #16121f 100%)',
]

const LEVEL_MARK: Record<RiskLevel, string> = {
  danger: 'Flagged',
  caution: 'Watch',
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

/**
 * Opaque purple-tinted panels with a slight unique gradient each.
 * `accent` = violet fill; never a red wash.
 */
function CardShell({
  variant = 'panel',
  className,
  children,
  as: Tag = 'section',
  ...rest
}: {
  variant?: 'panel' | 'panelAlt' | 'accent' | 'raised'
  className?: string
  children: React.ReactNode
  as?: 'section' | 'button' | 'div'
} & React.HTMLAttributes<HTMLElement> & { type?: 'button' | 'submit' }) {
  const isAccent = variant === 'accent'
  const isRaised = variant === 'raised'
  const panelGrad = React.useRef(
    (isRaised ? RAISED_GRADS : PANEL_GRADS)[
      Math.floor(Math.random() * (isRaised ? RAISED_GRADS.length : PANEL_GRADS.length))
    ],
  ).current

  return (
    <Tag
      className={cn('relative overflow-hidden', RADIUS, className)}
      style={{
        background: isAccent
          ? `linear-gradient(145deg, #9F7AEA 0%, #8B5CF6 45%, #5B21B6 100%)`
          : panelGrad,
        boxShadow: isAccent
          ? `0 4px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.28), inset 1px 0 0 rgba(196,181,253,.2), 0 0 0 1px rgba(196,181,253,.4)`
          : isRaised
            ? `0 10px 36px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18), 0 0 0 1px rgba(255,255,255,.16)`
            : `0 4px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(196,181,253,.16), inset 1px 0 0 rgba(255,255,255,.05), 0 0 0 1px rgba(255,255,255,.1)`,
      }}
      {...(rest as object)}
    >
      {!isAccent ? <div className="gg-card-grain" aria-hidden /> : null}
      {children}
    </Tag>
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
          'flex h-11 items-center gap-2 rounded-2xl border bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_8px_24px_rgba(0,0,0,.25)] backdrop-blur-xl transition-colors',
          error
            ? 'border-[#F87171]/50'
            : 'border-white/[0.1] focus-within:border-[#8b5cf6]/50',
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
          className="rounded-xl bg-[#8b5cf6] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#9b6fff]"
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
  const danger = report.overallLevel === 'danger'

  return (
    <CardShell
      variant="accent"
      className={cn('w-full', H_HERO)}
      aria-label="Safety grade"
    >
      <div className="absolute inset-0 z-[2] flex flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.06em] text-white/65 uppercase">
              Safety grade
            </div>
            <div className="mt-1.5 flex items-end gap-3">
              <span className="text-[52px] font-extralight leading-none tracking-[-0.05em]">
                {report.grade}
              </span>
              <span className="pb-1.5 font-mono text-[13px] font-semibold text-white/90">
                {report.overallScore}/100
              </span>
            </div>
          </div>
          <span
            className={cn(
              'pt-1 text-[12px] font-medium tracking-wide',
              danger
                ? 'text-white/90'
                : report.overallLevel === 'caution'
                  ? 'text-white/75'
                  : 'text-white/60',
            )}
          >
            {danger
              ? 'Do not sign yet'
              : report.overallLevel === 'caution'
                ? 'Review first'
                : 'Looks fine'}
          </span>
        </div>

        <h2 className="mt-3 text-[18px] font-semibold tracking-[-0.03em] leading-snug sm:text-[20px]">
          {report.verdict}
        </h2>
        <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/60">
          {report.verdictDetail}
        </p>

        <svg
          className="mt-auto block w-full"
          viewBox={`0 0 ${W} ${Hh}`}
          preserveAspectRatio="none"
          style={{ height: 72 }}
          aria-hidden
        >
          <defs>
            <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
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
            fill="#fff"
            stroke="rgba(0,0,0,.35)"
            strokeWidth="1"
          />
        </svg>
        <div className="mt-1 text-[11px] font-medium text-white/45">
          Risk score · last 14 days
        </div>
      </div>
    </CardShell>
  )
}

function AccountCard({
  report,
  tall = false,
}: {
  report: RecipientReport
  /** Stretch beside hero + metrics (Sapphire-style side rail). */
  tall?: boolean
}) {
  const { recipient, transaction } = report
  const isSearch = report.source === 'search'

  return (
    <CardShell
      variant="panel"
      className={cn(
        'flex w-full flex-col',
        tall ? 'h-full min-h-[420px]' : cn(H_HERO, 'lg:max-w-none'),
      )}
    >
      <div className="relative z-[2] flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[15px] font-semibold tracking-[-0.02em]">
            {isSearch ? 'Looked-up account' : 'Recipient'}
          </div>
          <span className="text-[12px] text-white/40">
            {isSearch ? 'Manual lookup' : 'Via Ledger'}
          </span>
        </div>

        <p className="mt-5 text-[14px] font-semibold">
          {recipient.displayName ?? 'No verified name'}
        </p>
        <code className="mt-2 break-all rounded-xl bg-black/30 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-white/70">
          {recipient.address}
        </code>

        <p className="mt-3 text-[12.5px] text-white/45">
          <span className={recipient.verified ? 'text-[#c4b5fd]' : 'text-[#f87171]'}>
            {recipient.verified ? 'Verified' : 'Unverified'}
          </span>
          <span className="text-white/25"> · </span>
          <span>{recipient.ageDays} days old</span>
        </p>

        {tall ? (
          <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-5">
            <div className="text-[11px] font-semibold tracking-[0.06em] text-white/40 uppercase">
              Quick facts
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/45">First seen</span>
              <span className="font-mono text-white/80">
                {new Date(recipient.firstSeen).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/45">Source</span>
              <span className="font-mono text-white/80">
                {isSearch ? 'Lookup' : 'Ledger'}
              </span>
            </div>
          </div>
        ) : null}

        {transaction ? (
          <div className="mt-auto pt-5">
            <div className="text-[11px] font-semibold tracking-[0.06em] text-white/40 uppercase">
              Signing now
            </div>
            <div className="mt-1 text-[28px] font-extralight tracking-[-0.04em] leading-none tabular-nums">
              {transaction.amountXrp.toLocaleString()}{' '}
              <span className="text-[14px] text-white/45">{transaction.currency}</span>
            </div>
            <p className="mt-2 text-[12.5px] text-[#f87171]">
              {transaction.percentOfSenderBalance}% of your balance
            </p>
          </div>
        ) : (
          <p className="mt-auto pt-5 text-[12.5px] leading-relaxed text-white/40">
            Manual lookup — no pending payment. Holder name is never shown for
            searched addresses.
          </p>
        )}
      </div>
    </CardShell>
  )
}

function SignalTile({
  signal,
  rankIndex,
  open,
  onToggle,
  className,
}: {
  signal: SafetySignal
  rankIndex: number
  open: boolean
  onToggle: () => void
  className?: string
}) {
  const color = LEVEL_COLOR[signal.level]

  return (
    <CardShell
      as="button"
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      variant="panel"
      className={cn(
        'flex w-full text-left transition hover:brightness-110',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]',
        open ? 'min-h-[148px] h-auto ring-1 ring-[#8b5cf6]/40' : H_METRIC,
        className,
      )}
    >
      {/* Accent bar — purple, never a red wash */}
      <div
        className="absolute top-4 bottom-4 left-0 w-[3px] rounded-r-full"
        style={{
          background:
            signal.level === 'danger'
              ? LEVEL_COLOR.danger
              : signal.level === 'caution'
                ? ACCENT
                : 'rgba(255,255,255,.2)',
        }}
      />
      <div className="relative z-[2] flex w-full flex-col p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-[12px] text-white/50">
            <span className="text-white/30">{rankIndex + 1}. </span>
            {signal.label}
          </div>
          <span className="shrink-0 text-[11px] font-medium" style={{ color }}>
            {LEVEL_MARK[signal.level]}
          </span>
        </div>
        <div className="mt-auto pt-3 text-[20px] font-extralight tracking-[-0.04em] leading-none tabular-nums text-white">
          {signal.value}
        </div>
        {open ? (
          <p className="mt-3 text-[12px] leading-relaxed text-white/60">
            {signal.detail}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-white/30">Details</p>
        )}
      </div>
    </CardShell>
  )
}

function ReputationCard({
  hits,
  className,
}: {
  hits: BlacklistHit[]
  className?: string
}) {
  const flagged = hits.some((h) => h.status === 'flagged')
  const [openSource, setOpenSource] = React.useState<string | null>(null)

  return (
    <CardShell
      variant="panel"
      className={cn(
        'flex min-h-[280px] w-full flex-col',
        flagged && 'ring-1 ring-[#F87171]/40',
        className,
      )}
    >
      <div className="relative z-[2] flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-semibold tracking-[-0.02em]">
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
                  'flex w-full flex-col gap-1 py-3 text-left transition hover:bg-white/[0.04]',
                  i > 0 && 'border-t border-white/[0.08]',
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
    </CardShell>
  )
}

function ActivityCard({
  report,
  className,
}: {
  report: RecipientReport
  className?: string
}) {
  const { activity } = report
  const hot = activity.avgTxPerDay > 30
  const vals = activity.dailyOutbound
  const max = Math.max(...vals, 1)
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <CardShell
      variant="raised"
      className={cn('flex min-h-[200px] w-full flex-1 flex-col', className)}
    >
      <div className="relative z-[2] flex h-full flex-col p-5">
        <div className="flex items-baseline justify-between">
          <div className="text-[15px] font-semibold tracking-[-0.02em]">Activity</div>
          <span className="text-[12px] text-white/40">Last 7 days</span>
        </div>
        <div className="mt-2 text-[28px] font-extralight tracking-[-0.04em] leading-none tabular-nums">
          {activity.avgTxPerDay}
          <span className="text-[13px] text-white/45"> tx/day</span>
        </div>
        <div className="mt-1 text-[12px] font-medium text-white/40">
          {activity.lastActive}
        </div>

        <div className="mt-auto flex items-end gap-1.5 pt-3" style={{ height: 88 }}>
          {vals.map((v, i) => {
            const h = Math.max(10, (v / max) * 64)
            const isLast = i === vals.length - 1
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full max-w-[12px] rounded-full"
                  style={{
                    height: h,
                    background: isLast
                      ? hot
                        ? LEVEL_COLOR.danger
                        : ACCENT
                      : 'rgba(255,255,255,.18)',
                  }}
                />
                <span className="text-[10px] text-white/30">{days[i]}</span>
              </div>
            )
          })}
        </div>
      </div>
    </CardShell>
  )
}

function FlowCard({
  report,
  className,
}: {
  report: RecipientReport
  className?: string
}) {
  const { activity } = report
  const outboundHeavy = activity.outboundShare >= 70
  return (
    <CardShell
      variant="raised"
      className={cn('flex min-h-[180px] w-full flex-1 flex-col', className)}
    >
      <div className="relative z-[2] flex h-full flex-col p-5">
        <div className="text-[15px] font-semibold tracking-[-0.02em]">Fund flow</div>
        <div className="mt-0.5 text-[12px] text-white/40">Inbound vs outbound</div>
        <div className="mt-auto space-y-4 pb-1">
          {(
            [
              ['Inbound', activity.inboundShare, '#fff'],
              [
                'Outbound',
                activity.outboundShare,
                outboundHeavy ? LEVEL_COLOR.danger : ACCENT,
              ],
            ] as const
          ).map(([label, share, color]) => (
            <div key={label}>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold">
                <span>{label}</span>
                <span className="font-mono">{share}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
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

        {section === 'overview' || section === 'lookup' ? (
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* Hero + tall recipient rail (Sapphire-style vertical side) */}
            <div className="grid grid-cols-12 items-stretch gap-4 sm:gap-5">
              <div className="col-span-12 flex flex-col gap-4 sm:gap-5 lg:col-span-8">
                {showHero ? <ScoreHero report={report} /> : null}
                {showSignals ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
                    {ranked.slice(0, 4).map((signal, index) => (
                      <SignalTile
                        key={signal.id}
                        signal={signal}
                        rankIndex={index}
                        open={openSignalId === signal.id}
                        onToggle={() =>
                          setOpenSignalId((id) =>
                            id === signal.id ? null : signal.id,
                          )
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              {showAccount ? (
                <div className="col-span-12 lg:col-span-4">
                  <AccountCard report={report} tall />
                </div>
              ) : null}
            </div>

            {/* Wide reputation + tall activity rail */}
            <div className="grid grid-cols-12 items-stretch gap-4 sm:gap-5">
              <div className="col-span-12 flex flex-col gap-4 sm:gap-5 lg:col-span-8">
                {showReputation ? (
                  <ReputationCard hits={report.blacklists} className="flex-1" />
                ) : null}
                {showSignals && ranked.length > 4 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    {ranked.slice(4).map((signal, index) => (
                      <SignalTile
                        key={signal.id}
                        signal={signal}
                        rankIndex={index + 4}
                        open={openSignalId === signal.id}
                        onToggle={() =>
                          setOpenSignalId((id) =>
                            id === signal.id ? null : signal.id,
                          )
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              {showActivity ? (
                <div className="col-span-12 flex min-h-[420px] flex-col gap-4 sm:gap-5 lg:col-span-4">
                  <ActivityCard report={report} />
                  <FlowCard report={report} />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:gap-5">
            {showSignals ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
                {ranked.map((signal, index) => (
                  <SignalTile
                    key={signal.id}
                    signal={signal}
                    rankIndex={index}
                    open={openSignalId === signal.id}
                    onToggle={() =>
                      setOpenSignalId((id) =>
                        id === signal.id ? null : signal.id,
                      )
                    }
                  />
                ))}
              </div>
            ) : null}

            {showReputation ? (
              <ReputationCard hits={report.blacklists} />
            ) : null}

            {showActivity ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <ActivityCard report={report} className="min-h-[260px]" />
                <FlowCard report={report} className="min-h-[260px]" />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default SafetyBento
