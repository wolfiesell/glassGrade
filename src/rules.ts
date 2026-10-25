import type { Amount, AnalysisInput, Analytics, RuleResult } from './types.js';

export function parseAmount(amount: AnalysisInput['payment']['amount']): Amount {
  return typeof amount === 'string' ? { value: Number(amount) / 1_000_000, currency: 'XRP' } : { value: Number(amount.value), currency: amount.currency, issuer: amount.issuer };
}
export function evaluateRules(input: AnalysisInput, _metrics: Analytics): RuleResult {
  const violations: string[] = [], unknowns: string[] = [];
  const { payment, intent, budget } = input;
  for (const field of payment.requiredFields) if (!payment[field]) violations.push(`Missing required field: ${field}`);
  const records = input.applicationRecords ?? [];
  if (payment.invoiceId && records.some(r => r.invoiceId === payment.invoiceId)) violations.push('Duplicate invoice payment detected');
  if (payment.taskId && records.some(r => r.taskId === payment.taskId)) violations.push('Duplicate task payment detected');
  if (intent) {
    if (intent.destination && intent.destination !== payment.destination) violations.push('Recipient does not match intent');
    if (intent.amount) {
      if (typeof intent.amount === 'string') {
        if (typeof payment.amount !== 'string' || payment.amount !== intent.amount) violations.push('Payment amount or asset type does not match intent');
      } else if (typeof payment.amount !== 'string') {
        if (intent.amount.value !== payment.amount.value) violations.push('Payment amount does not match intent');
        if (intent.amount.currency !== payment.amount.currency || (intent.amount.issuer && intent.amount.issuer !== payment.amount.issuer)) violations.push('Currency or issuer does not match intent');
      } else violations.push('Payment amount or asset type does not match intent');
    }
    if (intent.invoiceId && payment.invoiceId && intent.invoiceId !== payment.invoiceId) violations.push('Invoice ID does not match intent');
    if (intent.taskId && payment.taskId && intent.taskId !== payment.taskId) violations.push('Task ID does not match intent');
  } else unknowns.push('Original intent not supplied; recipient and amount authorization cannot be verified');
  if (budget) {
    const amount = parseAmount(payment.amount);
    if ((budget.currency && budget.currency !== amount.currency) || (amount.currency !== 'XRP' && budget.issuer && amount.issuer !== budget.issuer)) unknowns.push('Budget asset does not match payment asset');
    else if (budget.spent + amount.value > budget.limit) violations.push('Agent budget exceeded');
  } else unknowns.push('Authorization or agent budget not supplied');
  return { status: violations.length ? 'BLOCK' : unknowns.length ? 'INSUFFICIENT_DATA' : 'PASS', violations, unknowns };
}
