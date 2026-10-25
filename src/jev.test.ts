import { test } from 'node:test'
import assert from 'node:assert/strict'
import { explainJevError } from './jev.js'

test('explains insufficient Jev credits without exposing provider error details', () => {
  assert.equal(
    explainJevError({ statusCode: 402, message: 'private provider response' }),
    'Jev account has insufficient credits. Add credits in System One, then retry.',
  )
})

test('classifies Jev rate limits and unknown failures', () => {
  assert.match(explainJevError({ statusCode: 429 }), /rate-limited or busy/)
  assert.equal(explainJevError(new Error('network failure')), 'Jev advisory service unavailable.')
})
