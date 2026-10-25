export type RiskLevel = 'safe' | 'caution' | 'danger'

export type SafetySignal = {
  id: string
  label: string
  detail: string
  value: string
  level: RiskLevel
  weight: number
}

export type BlacklistHit = {
  source: string
  status: 'clear' | 'flagged' | 'unknown'
  note: string
}

export type RiskHistoryPoint = {
  date: string
  score: number
  ageRisk: number
  velocityRisk: number
  reputationRisk: number
}

export type RecipientReport = {
  /** ledger = deep-link from device; search = manual XRPL lookup */
  source: 'ledger' | 'search'
  overallScore: number
  overallLevel: RiskLevel
  grade: string
  verdict: string
  verdictDetail: string
  recipient: {
    address: string
    /** Always null for search lookups — no clear-signed name. */
    displayName: string | null
    verified: boolean
    firstSeen: string
    ageDays: number
  }
  transaction: {
    amountXrp: number
    currency: string
    percentOfSenderBalance: number
    memo: string | null
  } | null
  signals: SafetySignal[]
  blacklists: BlacklistHit[]
  activity: {
    avgTxPerDay: number
    lastActive: string
    inboundShare: number
    outboundShare: number
    recentTxCount: number
    dailyOutbound: number[]
  }
  riskHistory: RiskHistoryPoint[]
}

function hashAddress(address: string) {
  let h = 0
  for (let i = 0; i < address.length; i++) {
    h = (h * 31 + address.charCodeAt(i)) >>> 0
  }
  return h
}

function gradeFromScore(score: number): { grade: string; level: RiskLevel } {
  if (score >= 75) return { grade: 'A', level: 'safe' }
  if (score >= 60) return { grade: 'B', level: 'safe' }
  if (score >= 45) return { grade: 'C', level: 'caution' }
  if (score >= 30) return { grade: 'D', level: 'danger' }
  return { grade: 'F', level: 'danger' }
}

function buildRiskHistory(score: number, seed: number): RiskHistoryPoint[] {
  return Array.from({ length: 14 }, (_, i) => {
    const t = i / 13
    const wobble = Math.sin(i * 1.1 + seed) * 4
    return {
      date: new Date(2026, 9, 10 + i).toISOString(),
      score: Math.max(5, Math.min(95, Math.round(score + 20 - t * 25 + wobble))),
      ageRisk: Math.round(10 + t * 40),
      velocityRisk: Math.round(20 + t * 30 + Math.sin(i + seed) * 5),
      reputationRisk: Math.round(15 + t * 35),
    }
  })
}

/** Default deep-link report from Ledger warning. */
export const mockReport: RecipientReport = {
  source: 'ledger',
  overallScore: 28,
  overallLevel: 'danger',
  grade: 'D',
  verdict: 'High risk — review before signing',
  verdictDetail:
    'New address, fast outbound activity, and a large share of your balance. Ledger flagged it; here’s why.',
  recipient: {
    address: 'rN7n7otQDd6FczFgLdlqtyMVrn3tQmHk9r',
    displayName: null,
    verified: false,
    firstSeen: '2026-10-22T14:08:00Z',
    ageDays: 2,
  },
  transaction: {
    amountXrp: 12_450,
    currency: 'XRP',
    percentOfSenderBalance: 67,
    memo: null,
  },
  // Ordered by scam-detection importance: blacklist → creation → age → velocity → balance → familiarity
  signals: [
    {
      id: 'blacklist',
      label: 'Blacklist status',
      detail:
        'Flagged on 1 of 4 public reputation sources checked for known scam / phishing clusters.',
      value: '1 source flagged',
      level: 'danger',
      weight: 25,
    },
    {
      id: 'creation',
      label: 'Creation circumstances',
      detail:
        'Funded by a high-churn intermediary with no human-readable account domain set.',
      value: 'Suspicious funding path',
      level: 'danger',
      weight: 18,
    },
    {
      id: 'age',
      label: 'Address age',
      detail:
        'Created only 2 days ago. Legitimate counterparts are usually older and have a longer on-ledger history.',
      value: '2 days old',
      level: 'danger',
      weight: 22,
    },
    {
      id: 'velocity',
      label: 'Transaction velocity',
      detail:
        'Average outbound pace is far above typical personal wallets — consistent with drain or mixer-like behavior.',
      value: '48 tx / day',
      level: 'caution',
      weight: 15,
    },
    {
      id: 'balance-share',
      label: 'Share of your balance',
      detail:
        'You are about to send 67% of the XRP currently on this Ledger account in a single payment.',
      value: '67% of wallet',
      level: 'danger',
      weight: 12,
    },
    {
      id: 'familiarity',
      label: 'New to you',
      detail:
        'You have never sent to or received from this address before on this device.',
      value: 'First interaction',
      level: 'caution',
      weight: 8,
    },
  ],
  blacklists: [
    {
      source: 'XRPL Scam Tracker',
      status: 'flagged',
      note: 'Address cluster linked to recent phishing reports',
    },
    {
      source: 'Community Deny List',
      status: 'clear',
      note: 'Not present on this list',
    },
    {
      source: 'Exchange risk feed',
      status: 'unknown',
      note: 'No public match / feed unavailable',
    },
    {
      source: 'Known mixer hop set',
      status: 'clear',
      note: 'Not in published hop set',
    },
  ],
  activity: {
    avgTxPerDay: 48,
    lastActive: '12 minutes ago',
    inboundShare: 18,
    outboundShare: 82,
    recentTxCount: 214,
    dailyOutbound: [12, 28, 41, 55, 38, 62, 48],
  },
  riskHistory: buildRiskHistory(28, 3),
}

const PRESETS: Record<string, Partial<RecipientReport>> = {
  rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY: {
    overallScore: 82,
    grade: 'A',
    overallLevel: 'safe',
    verdict: 'Looks safe to interact with',
    verdictDetail:
      'Long-lived address with steady activity and no public blacklist hits.',
    recipient: {
      address: 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
      displayName: null,
      verified: false,
      firstSeen: '2018-03-12T00:00:00Z',
      ageDays: 2845,
    },
  },
}

/** Loose XRPL classic address check (starts with r, ~25–35 alphanumerics). */
export function isLikelyXrplAddress(value: string) {
  const v = value.trim()
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(v)
}

/**
 * Lookup an XRPL address for the search bar.
 * Searched accounts never include a clear-signed holder name.
 */
export function lookupAddress(raw: string): RecipientReport | null {
  const address = raw.trim()
  if (!isLikelyXrplAddress(address)) return null

  if (address === mockReport.recipient.address) {
    return {
      ...mockReport,
      source: 'search',
      recipient: { ...mockReport.recipient, displayName: null },
      transaction: null,
    }
  }

  const preset = PRESETS[address]
  const seed = hashAddress(address)
  const score =
    preset?.overallScore ??
    20 + (seed % 70)
  const { grade, level } = gradeFromScore(score)
  const ageDays = preset?.recipient?.ageDays ?? 1 + (seed % 900)
  const avgTx = 2 + (seed % 60)
  const flagged = score < 40
  const cautionVelocity = avgTx > 30

  // Same scam-importance order as the Ledger deep-link report
  const signals: SafetySignal[] = [
    {
      id: 'blacklist',
      label: 'Blacklist status',
      detail: flagged
        ? 'Appears on at least one public scam / phishing reputation feed.'
        : 'No hits across the public deny lists we checked.',
      value: flagged ? '1 source flagged' : 'No hits',
      level: flagged ? 'danger' : 'safe',
      weight: flagged ? 26 : 10,
    },
    {
      id: 'creation',
      label: 'Creation circumstances',
      detail:
        score < 45
          ? 'Funding path looks high-churn / intermediary-like.'
          : 'No obvious suspicious funding pattern in public history.',
      value: score < 45 ? 'Suspicious funding path' : 'Normal funding path',
      level: score < 45 ? 'danger' : 'safe',
      weight: score < 45 ? 18 : 8,
    },
    {
      id: 'age',
      label: 'Address age',
      detail:
        ageDays < 14
          ? 'Very new address with little on-ledger history.'
          : ageDays < 180
            ? 'Relatively young address — treat large payments carefully.'
            : 'Address has been on ledger for a meaningful period.',
      value: ageDays < 30 ? `${ageDays} days old` : `${Math.round(ageDays / 30)} mo old`,
      level: ageDays < 14 ? 'danger' : ageDays < 180 ? 'caution' : 'safe',
      weight: ageDays < 14 ? 24 : ageDays < 180 ? 14 : 8,
    },
    {
      id: 'velocity',
      label: 'Transaction velocity',
      detail: cautionVelocity
        ? 'Outbound pace is high relative to typical personal wallets.'
        : 'Transaction pace looks within a normal personal-wallet range.',
      value: `${avgTx} tx / day`,
      level: cautionVelocity ? 'caution' : 'safe',
      weight: cautionVelocity ? 16 : 9,
    },
    {
      id: 'familiarity',
      label: 'New to you',
      detail: 'You have not interacted with this address on this device before.',
      value: 'First interaction',
      level: 'caution',
      weight: 8,
    },
  ]

  const firstSeen = new Date()
  firstSeen.setDate(firstSeen.getDate() - ageDays)

  return {
    source: 'search',
    overallScore: score,
    overallLevel: preset?.overallLevel ?? level,
    grade: preset?.grade ?? grade,
    verdict:
      preset?.verdict ??
      (level === 'danger'
        ? 'High risk — review carefully'
        : level === 'caution'
          ? 'Some caution advised'
          : 'Looks relatively safe'),
    verdictDetail:
      preset?.verdictDetail ??
      'Manual lookup — no clear-signed account holder name is available for this address.',
    recipient: {
      address,
      displayName: null,
      verified: false,
      firstSeen: preset?.recipient?.firstSeen ?? firstSeen.toISOString(),
      ageDays,
    },
    transaction: null,
    signals,
    blacklists: [
      {
        source: 'XRPL Scam Tracker',
        status: flagged ? 'flagged' : 'clear',
        note: flagged
          ? 'Address cluster linked to recent phishing reports'
          : 'Not present on this list',
      },
      {
        source: 'Community Deny List',
        status: 'clear',
        note: 'Not present on this list',
      },
      {
        source: 'Exchange risk feed',
        status: score % 3 === 0 ? 'unknown' : 'clear',
        note:
          score % 3 === 0
            ? 'No public match / feed unavailable'
            : 'Not present on this list',
      },
      {
        source: 'Known mixer hop set',
        status: 'clear',
        note: 'Not in published hop set',
      },
    ],
    activity: {
      avgTxPerDay: avgTx,
      lastActive: `${1 + (seed % 40)} minutes ago`,
      inboundShare: 15 + (seed % 40),
      outboundShare: 100 - (15 + (seed % 40)),
      recentTxCount: 40 + (seed % 200),
      dailyOutbound: Array.from({ length: 7 }, (_, i) => 5 + ((seed >> i) % 50)),
    },
    riskHistory: buildRiskHistory(score, seed % 11),
  }
}
