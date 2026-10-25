import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountAddressCliArgs, discoveryCliArgs, dryRunXrpPayment, paymentCliArgs, proposalAnalysisInput, xrpAmountToDrops, xrpPaymentProposalSchema } from './ledger-wallet.js';

const proposal = {
  network: 'xrp:testnet' as const,
  sender: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  account: 'ripple-testnet-1',
  recipient: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  amount: '1.25',
  destinationTag: 42,
};

test('validates only native XRP Testnet proposals', () => {
  assert.equal(xrpPaymentProposalSchema.safeParse(proposal).success, true);
  assert.equal(xrpPaymentProposalSchema.safeParse({ ...proposal, budget: { limit: 20, spent: 5 } }).success, true);
  assert.equal(xrpPaymentProposalSchema.safeParse({ ...proposal, budget: { limit: 0, spent: 5 } }).success, false);
  assert.equal(xrpPaymentProposalSchema.safeParse({ ...proposal, network: 'xrp:mainnet' }).success, false);
  assert.equal(xrpPaymentProposalSchema.safeParse({ ...proposal, amount: '1.1234567' }).success, false);
  assert.equal(xrpPaymentProposalSchema.safeParse({ ...proposal, destinationTag: 4_294_967_296 }).success, false);
});

test('converts XRP decimals to exact drops for analysis', () => {
  assert.equal(xrpAmountToDrops('1.25'), '1250000');
  assert.equal(xrpAmountToDrops('0.000001'), '1');
  assert.deepEqual(proposalAnalysisInput(proposal).payment, {
    account: proposal.sender,
    destination: proposal.recipient,
    amount: '1250000',
    requiredFields: [],
  });
});

test('passes caller-supplied XRP budget to review rules', () => {
  const withBudget = xrpPaymentProposalSchema.parse({ ...proposal, budget: { limit: 20, spent: 5 } });
  assert.deepEqual(proposalAnalysisInput(withBudget).budget, {
    limit: 20,
    spent: 5,
    currency: 'XRP',
  });
});

test('builds fixed CLI argv without shell syntax', () => {
  assert.deepEqual(discoveryCliArgs(), ['account', 'discover', '--network', 'ripple:testnet', '--output', 'json']);
  assert.deepEqual(paymentCliArgs(proposal, true), [
    'send', '--account', 'ripple-testnet-1', '--to', proposal.recipient,
    '--amount', '1.25 XRP', '--destination-tag', '42', '--dry-run', '--output', 'json',
  ]);
  assert.equal(paymentCliArgs(proposal, false).includes('--dry-run'), false);
  assert.deepEqual(accountAddressCliArgs(proposal.account), [
    'receive', '--account', proposal.account, '--no-verify', '--output', 'json',
  ]);
});

test('dry run reports prepared without a transaction hash requirement', async () => {
  const calls: string[][] = [];
  const result = await dryRunXrpPayment(proposal, async args => {
    calls.push([...args]);
    const stdout = args[0] === 'receive'
      ? JSON.stringify({ address: proposal.sender })
      : JSON.stringify({ dry_run: true, recipient: proposal.recipient });
    return { stdout, stderr: '' };
  });
  assert.equal(result.status, 'prepared');
  assert.equal(result.dryRun, true);
  assert.equal(calls.length, 2);
});
