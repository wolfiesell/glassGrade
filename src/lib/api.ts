export type XrpPaymentProposal = {
  network: 'xrp:testnet'
  sender: string
  account: string
  recipient: string
  amount: string
  destinationTag?: number
  budget?: { limit: number; spent: number; currency: 'XRP' }
}

export type QrTransactionRequest = { tx: string; net: 'testnet'; code?: string; limit?: number }
export type QrReviewJevResponse = {
  jev: {
    category: string
    intentClarity: string
    contextualConcern: string
    contextualRisk: number
    requiresReview: boolean
    latencyMs: number
  } | null
  jevError?: string
  decision: string
  jevPending: boolean
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload
      ? String(payload.detail)
      : typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : `Request failed (${response.status})`
    throw new Error(detail)
  }
  return payload as T
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

function amountToDrops(amount: string): string {
  const [whole, fraction = ''] = amount.split('.')
  return `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '')
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  serviceInfo: () => request<{ service: string; routes: Record<string, string> }>('/api/info'),
  discoverXrpAccounts: () => post<{ status: string; accounts: unknown; dataSource: string }>('/ledger/xrp/discover', {}),
  reviewXrpPayment: (proposal: XrpPaymentProposal) => post('/ledger/xrp/review', proposal),
  reviewQrTransaction: (request: QrTransactionRequest) => post('/ledger/xrp/qr-review', request),
  reviewQrTransactionWithJev: (requestId: string) => post<QrReviewJevResponse>(`/ledger/xrp/qr-review/${encodeURIComponent(requestId)}/jev`, {}),
  dryRunXrpPayment: (proposal: XrpPaymentProposal) => post('/ledger/xrp/dry-run', proposal),
  sendXrpPayment: (proposal: XrpPaymentProposal) => post('/ledger/xrp/send', proposal),
  analyzeTransaction: (proposal: XrpPaymentProposal) => post('/analyze-transaction', {
    payment: {
      account: proposal.sender,
      destination: proposal.recipient,
      amount: amountToDrops(proposal.amount),
      requiredFields: [],
    },
    intent: {
      destination: proposal.recipient,
      amount: amountToDrops(proposal.amount),
    },
    ...(proposal.budget ? { budget: proposal.budget } : {}),
  }),
}
