'use client'

import * as React from 'react'
import {
  Home,
  ShieldAlert,
  Search,
  Activity,
  ListChecks,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SafetyBento, type SafetySection } from '@/components/ui/safety-bento'
import { CrystalBallBackground } from '@/components/crystal-ball-background'
import { mockReport } from '@/data/mockRecipient'
import { LedgerXrpReview, LiveXrplDashboard } from '@/components/ledger-xrp-review'

type NavId = SafetySection | 'review' | 'live'

const NAV: {
  id: NavId
  title: string
  Icon: React.ComponentType<{ className?: string }>
  notifs?: number
}[] = [
  { id: 'overview', title: 'Sample overview', Icon: Home },
  { id: 'signals', title: 'Sample signals', Icon: ShieldAlert, notifs: 4 },
  { id: 'reputation', title: 'Sample reputation', Icon: ListChecks, notifs: 1 },
  { id: 'activity', title: 'Sample activity', Icon: Activity },
  { id: 'lookup', title: 'Sample lookup', Icon: Search },
  { id: 'live', title: 'Live data', Icon: Activity },
  { id: 'review', title: 'XRPL review', Icon: ShieldAlert },
]

function Option({
  Icon,
  title,
  selected,
  onSelect,
  open,
  notifs,
}: {
  Icon: React.ComponentType<{ className?: string }>
  title: string
  selected: boolean
  onSelect: () => void
  open: boolean
  notifs?: number
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex h-11 w-full items-center rounded-lg transition-all duration-200',
        selected
          ? 'rounded-xl bg-[#8b5cf6]/20 text-[#c4b5fd] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-[#8b5cf6]/35'
          : 'text-white/45 hover:bg-white/[0.04] hover:text-white/80',
      )}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-4 w-4" />
      </div>
      {open ? (
        <span className="text-sm font-medium transition-opacity">{title}</span>
      ) : null}
      {notifs && open ? (
        <span className="absolute right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8b5cf6] px-1 text-[11px] font-semibold text-white">
          {notifs}
        </span>
      ) : null}
    </button>
  )
}

function Sidebar({
  open,
  setOpen,
  selected,
  setSelected,
  dangerCount,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  selected: NavId
  setSelected: (v: NavId) => void
  dangerCount: number
}) {
  return (
    <nav
      className={cn(
        'relative z-30 flex h-full min-h-0 shrink-0 flex-col self-stretch border-r border-white/[0.06] bg-[#0c0c10]/92 p-2 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-2xl transition-all duration-300 ease-in-out',
        open ? 'w-64' : 'w-16',
      )}
    >
      <div className="mb-6 border-b border-white/[0.08] pb-4">
        <div className="flex items-center rounded-lg p-2">
          <div className={cn('overflow-hidden', open ? 'w-full' : 'mx-auto w-8')}>
            <img
              src="/glassgrade-logo.png"
              alt="glassgrade"
              className={cn(
                'max-w-none object-left',
                open ? 'h-11 w-auto sm:h-12' : 'h-9 w-auto',
              )}
            />
          </div>
        </div>
        {open ? (
          <p className="mt-1 px-2 text-[11px] text-white/35">
            XRPL clear-sign review
          </p>
        ) : null}
      </div>

      <div className="mb-6 space-y-1">
        {NAV.map((item) => (
          <Option
            key={item.id}
            Icon={item.Icon}
            title={item.title}
            selected={selected === item.id}
            onSelect={() => setSelected(item.id)}
            open={open}
            notifs={
              item.id === 'signals'
                ? dangerCount
                : item.id === 'reputation'
                  ? 1
                  : undefined
            }
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-auto border-t border-white/[0.08] transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex items-center p-3">
          <div className="grid size-10 place-content-center">
            <ChevronsRight
              className={cn(
                'h-4 w-4 text-white/40 transition-transform duration-300',
                open && 'rotate-180',
              )}
            />
          </div>
          {open ? (
            <span className="text-sm font-medium text-white/50">Hide</span>
          ) : null}
        </div>
      </button>
    </nav>
  )
}

function sectionCopy(section: NavId) {
  switch (section) {
    case 'signals':
      return {
        title: 'Sample risk signals',
        subtitle: 'Demonstration data · not returned by the live API',
      }
    case 'reputation':
      return {
        title: 'Sample reputation',
        subtitle: 'Demonstration data · not returned by the live API',
      }
    case 'activity':
      return {
        title: 'Sample activity',
        subtitle: 'Demonstration data · not returned by the live API',
      }
    case 'lookup':
      return {
        title: 'Sample address lookup',
        subtitle: 'Generated demo results · not a live XRPL lookup',
      }
    case 'review':
      return {
        title: 'XRPL Testnet review',
        subtitle: 'Connect Ledger Wallet CLI, XRPL history, deterministic checks, and Jev advisory',
      }
    case 'live':
      return {
        title: 'Live XRPL data',
        subtitle: 'Metrics from your latest successful Testnet review',
      }
    default:
      return {
        title: 'Sample safety overview',
        subtitle: 'Demonstration report · not connected to live XRPL data',
      }
  }
}

export function GlassGradeDashboard() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [selected, setSelected] = React.useState<NavId>('review')
  const [report, setReport] = React.useState(mockReport)
  const [liveResult, setLiveResult] = React.useState<unknown>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const wheelRef = React.useRef<HTMLDivElement>(null)
  const rafRef = React.useRef(0)

  const dangerCount = report.signals.filter((s) => s.level === 'danger').length
  const copy = sectionCopy(selected)

  React.useEffect(() => {
    let running = true
    function tick() {
      if (!running) return
      const scrollY = scrollRef.current?.scrollTop ?? 0
      const wheel = wheelRef.current
      if (wheel) {
        const tilt = Math.min(scrollY / 900, 1) * 4.5
        wheel.style.transform = `perspective(1600px) rotateX(${tilt}deg)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div className="relative flex h-svh w-full overflow-hidden bg-transparent text-white antialiased">
      <CrystalBallBackground />

      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        selected={selected}
        setSelected={setSelected}
        dangerCount={dangerCount}
      />

      <div
        ref={scrollRef}
        className="relative z-10 flex min-w-0 flex-1 flex-col overflow-auto bg-transparent"
      >
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.05] bg-[#09090b]/55 px-6 py-4 backdrop-blur-2xl">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {copy.title}
            </h1>
            <p className="mt-0.5 text-sm text-white/40">{copy.subtitle}</p>
          </div>
          {selected === 'review' ? null : (
            <div className="hidden rounded-full border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#a78bfa] backdrop-blur-md sm:block">
              Demo grade {report.grade} · {report.overallScore}/100
            </div>
          )}
        </header>

        <main className="flex-1 p-6 pb-48 sm:p-8 sm:pb-56">
          {selected === 'review' ? (
            <LedgerXrpReview onLiveResult={setLiveResult} />
          ) : selected === 'live' ? (
            <LiveXrplDashboard result={liveResult} onOpenReview={() => setSelected('review')} />
          ) : <div
            ref={wheelRef}
            className="gg-wheel mx-auto w-full max-w-[1200px]"
            style={{ transformOrigin: '50% 0%' }}
          >
            <SafetyBento
              report={report}
              onReportChange={setReport}
              section={selected}
              embedded
              className="w-full"
            />
          </div>}
        </main>
      </div>
    </div>
  )
}

export default GlassGradeDashboard
