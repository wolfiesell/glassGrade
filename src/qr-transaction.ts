import { decode } from 'ripple-binary-codec'
import { z } from 'zod'
import { xrpPaymentProposalSchema } from './ledger-wallet.js'

export const qrTransactionSchema = z.object({
  tx: z.string().regex(/^(?:[0-9a-f]{2})+$/i, 'Transaction must be even-length hexadecimal').max(8192),
  net: z.literal('testnet'),
  code: z.string().max(64).optional(),
})

export type QrTransactionRequest = z.infer<typeof qrTransactionSchema>

export type DecodedQrPayment = {
  code?: string
  proposal: z.infer<typeof xrpPaymentProposalSchema>
  transaction: {
    type: 'Payment'
    amountDrops: string
    feeDrops?: string
    sequence?: number
  }
}

export class QrTransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QrTransactionError'
  }
}

function dropsToXrp(drops: string): string {
  const value = BigInt(drops)
  const whole = value / 1_000_000n
  const fraction = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

export function decodeQrPayment(request: QrTransactionRequest): DecodedQrPayment {
  let transaction: Record<string, unknown>
  try {
    transaction = decode(request.tx)
  } catch {
    throw new QrTransactionError('QR transaction could not be decoded')
  }

  if (transaction.TransactionType !== 'Payment') {
    throw new QrTransactionError('Only XRPL Payment transactions can be reviewed')
  }
  if (typeof transaction.Account !== 'string' || typeof transaction.Destination !== 'string') {
    throw new QrTransactionError('QR payment is missing a sender or recipient')
  }
  if (typeof transaction.Amount !== 'string' || !/^[1-9]\d*$/.test(transaction.Amount)) {
    throw new QrTransactionError('Only positive native XRP payments are supported')
  }
  if (transaction.TxnSignature || transaction.Signers) {
    throw new QrTransactionError('QR must contain an unsigned proposal, not a signed transaction')
  }

  const destinationTag = transaction.DestinationTag
  const proposal = xrpPaymentProposalSchema.safeParse({
    network: 'xrp:testnet',
    sender: transaction.Account,
    account: 'qr-review',
    recipient: transaction.Destination,
    amount: dropsToXrp(transaction.Amount),
    ...(typeof destinationTag === 'number' ? { destinationTag } : {}),
  })
  if (!proposal.success) {
    throw new QrTransactionError('QR payment contains invalid XRPL fields')
  }

  return {
    ...(request.code ? { code: request.code } : {}),
    proposal: proposal.data,
    transaction: {
      type: 'Payment',
      amountDrops: transaction.Amount,
      ...(typeof transaction.Fee === 'string' ? { feeDrops: transaction.Fee } : {}),
      ...(typeof transaction.Sequence === 'number' ? { sequence: transaction.Sequence } : {}),
    },
  }
}
