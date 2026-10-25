import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encode } from 'ripple-binary-codec'
import { decodeQrPayment, QrTransactionError, qrTransactionSchema } from './qr-transaction.js'

const payment = {
  TransactionType: 'Payment',
  Account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  Amount: '25000000',
  Fee: '12',
  Sequence: 1,
  DestinationTag: 42,
  SigningPubKey: '',
}

test('decodes the QR Testnet Payment into the review proposal', () => {
  const result = decodeQrPayment({ tx: encode(payment), net: 'testnet', code: 'A018' })
  assert.equal(result.proposal.amount, '25')
  assert.equal(result.proposal.sender, payment.Account)
  assert.equal(result.proposal.recipient, payment.Destination)
  assert.equal(result.proposal.destinationTag, 42)
  assert.equal(result.transaction.amountDrops, '25000000')
  assert.equal(result.code, 'A018')
})

test('rejects malformed hex, non-payment, issued-asset, and signed QR data', () => {
  assert.equal(qrTransactionSchema.safeParse({ tx: '123', net: 'testnet' }).success, false)
  assert.throws(() => decodeQrPayment({ tx: encode({
    TransactionType: 'AccountSet',
    Account: payment.Account,
    Fee: '12',
    Sequence: 1,
    SigningPubKey: '',
  }), net: 'testnet' }), QrTransactionError)
  assert.throws(() => decodeQrPayment({ tx: encode({ ...payment, Amount: { currency: 'USD', issuer: payment.Account, value: '1' } }), net: 'testnet' }), QrTransactionError)
  assert.throws(() => decodeQrPayment({ tx: encode({ ...payment, TxnSignature: 'AABB' }), net: 'testnet' }), QrTransactionError)
})
