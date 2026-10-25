import { test } from 'node:test'
import assert from 'node:assert/strict'
import { historyCoversWindow, sumOutgoingXrpSince } from './budget.js'
import { qrTransactionSchema } from './qr-transaction.js'

const me = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'
const other = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'
const now = Date.parse('2026-10-25T12:00:00Z')
const since = now - 24 * 3_600_000
const record = (over: Partial<{ account: string; amount: unknown; delivered: unknown; result: string; at: string; type: string; validated: boolean }>) => ({
  tx: { TransactionType: over.type ?? 'Payment', Account: over.account ?? me, Destination: other, Amount: over.amount ?? '5000000' },
  meta: { TransactionResult: over.result ?? 'tesSUCCESS', ...(over.delivered !== undefined ? { delivered_amount: over.delivered } : {}) },
  validated: over.validated ?? true,
  close_time_iso: over.at ?? '2026-10-25T10:00:00Z',
})

test('sums only validated, successful outgoing XRP payments inside the window', () => {
  const records = [
    record({}),                                                    // 5 XRP, counts
    record({ amount: '2000000', delivered: '1500000' }),           // counts what was delivered: 1.5
    record({ account: other }),                                    // incoming: ignored
    record({ result: 'tecPATH_DRY' }),                             // failed: ignored
    record({ validated: false }),                                  // not validated: ignored
    record({ type: 'TrustSet' }),                                  // not a payment: ignored
    record({ amount: { currency: 'USD', issuer: other, value: '9' } }), // token: ignored
    record({ at: '2026-10-24T11:59:59Z' }),                        // before the window: ignored
  ]
  assert.equal(sumOutgoingXrpSince(records, me, since), 6.5)
})

test('history covers the window once it reaches past the start, or has no more pages', () => {
  assert.equal(historyCoversWindow([record({ at: '2026-10-24T09:00:00Z' })], true, since), true)
  assert.equal(historyCoversWindow([record({ at: '2026-10-25T09:00:00Z' })], true, since), false)
  assert.equal(historyCoversWindow([record({ at: '2026-10-25T09:00:00Z' })], false, since), true)
})

test('QR request accepts an optional positive spending limit', () => {
  const tx = '1200'
  assert.equal(qrTransactionSchema.safeParse({ tx, net: 'testnet', limit: 50 }).success, true)
  assert.equal(qrTransactionSchema.safeParse({ tx, net: 'testnet', limit: 0 }).success, false)
  assert.equal(qrTransactionSchema.safeParse({ tx, net: 'testnet' }).success, true)
})
