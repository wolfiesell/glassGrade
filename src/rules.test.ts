import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRules, parseAmount } from './rules.js';
import type { AnalysisInput, Analytics } from './types.js';

const addr='rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';
const metrics:Analytics={amountDeviation:null,firstTimeRecipient:null,senderActivity:null,recipientActivity:null,paymentsPerHour:null,unusualActivity:null,uniqueCounterparties:null,budgetUtilization:null,intentConsistency:{amount:null,recipient:null,currency:null},accountInfo:{senderExists:null,recipientExists:null,senderBalanceXrp:null,recipientBalanceXrp:null},historyComplete:false};
const base:AnalysisInput={payment:{account:addr,destination:addr,amount:'10000000',requiredFields:[]},intent:{destination:addr,amount:'10000000'},budget:{limit:20,spent:5,currency:'XRP'}};

test('XRP drops are converted to XRP for analytics and budget checks',()=>{
  assert.deepEqual(parseAmount('10000000'),{value:10,currency:'XRP'});
  assert.equal(evaluateRules(base,metrics).status,'PASS');
  assert.equal(evaluateRules({...base,intent:{...base.intent,amount:'9000000'}},metrics).status,'BLOCK');
});
test('blocks an amount beyond the agent budget',()=>{
  const result=evaluateRules({...base,budget:{limit:10,spent:1,currency:'XRP'}},metrics);
  assert.equal(result.status,'BLOCK');
  assert.match(result.violations.join(' '),/budget exceeded/i);
});
test('blocks recipient mismatch and duplicate invoices',()=>{
  const other='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
  const result=evaluateRules({...base,intent:{destination:other},applicationRecords:[{invoiceId:'inv-1'}],payment:{...base.payment,invoiceId:'inv-1'}},metrics);
  assert.equal(result.status,'BLOCK');
  assert.equal(result.violations.length,2);
});
test('reports insufficient data when the original intent is missing',()=>{
  assert.equal(evaluateRules({...base,intent:undefined},metrics).status,'INSUFFICIENT_DATA');
});
test('blocks required transaction fields that are absent',()=>{
  const result=evaluateRules({...base,payment:{...base.payment,requiredFields:['taskId']}},metrics);
  assert.equal(result.status,'BLOCK');
});
