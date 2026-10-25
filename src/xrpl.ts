import { Client } from 'xrpl';
import { parseAmount } from './rules.js';
import type { AnalysisInput, Analytics } from './types.js';

type TxRecord = { tx: Record<string, unknown>; tx_json?: Record<string, unknown>; meta?: Record<string, unknown>; validated?: boolean; close_time_iso?: string };
type History = { records: TxRecord[]; complete: boolean };
type AccountSnapshot = { exists: boolean | null; balanceXrp: number | null };
const historyLimit = Math.min(500, Math.max(10, Number(process.env.XRPL_HISTORY_LIMIT ?? 100)));

export class XrplAnalyticsService {
  private client = new Client(process.env.XRPL_WS_URL ?? 'wss://s.altnet.rippletest.net:51233');
  private connecting?: Promise<void>;
  async connect(): Promise<void> {
    if (this.client.isConnected()) return;
    this.connecting ??= this.client.connect().finally(() => { this.connecting = undefined; });
    await this.connecting;
  }
  async close(): Promise<void> { if (this.client.isConnected()) await this.client.disconnect(); }
  private async history(account: string): Promise<History> {
    await this.connect();
    let response;
    try {
      response = await this.client.request({ command: 'account_tx', account, api_version: 2, ledger_index_min: -1, ledger_index_max: -1, limit: historyLimit, forward: false });
    } catch (error) {
      const detail = error as { data?: { error?: string }; error?: string };
      if (detail.data?.error === 'actNotFound' || detail.error === 'actNotFound') return { records: [], complete: true };
      throw error;
    }
    const records = ((response.result.transactions ?? []) as unknown as TxRecord[]).map(r => ({ ...r, tx: r.tx_json ?? r.tx ?? {} }));
    return { records, complete: !response.result.marker && records.length < historyLimit };
  }
  private async accountInfo(account: string): Promise<AccountSnapshot> {
    await this.connect();
    try {
      const response = await this.client.request({ command: 'account_info', account, ledger_index: 'validated' });
      const balance = response.result.account_data?.Balance;
      return { exists: Boolean(response.result.account_data), balanceXrp: typeof balance === 'string' ? Number(balance) / 1_000_000 : null };
    } catch (error) {
      const detail = error as { data?: { error?: string }; error?: string };
      if (detail.data?.error === 'actNotFound' || detail.error === 'actNotFound') return { exists: false, balanceXrp: null };
      throw error;
    }
  }
  async analyze(input: AnalysisInput): Promise<Analytics> {
    const [sender, recipient, senderInfo, recipientInfo] = await Promise.all([
      this.history(input.payment.account), this.history(input.payment.destination),
      this.accountInfo(input.payment.account), this.accountInfo(input.payment.destination)
    ]);
    const target = parseAmount(input.payment.amount);
    const good = (r: TxRecord) => r.validated !== false && r.tx.TransactionType === 'Payment' && r.meta?.TransactionResult === 'tesSUCCESS';
    const sent = sender.records.filter(r => good(r) && r.tx.Account === input.payment.account);
    const values = sent.filter(r => { try { const a=parseAmount(r.tx.Amount as AnalysisInput['payment']['amount']); return a.currency===target.currency && a.issuer===target.issuer; } catch { return false; } })
      .map(r => parseAmount(r.tx.Amount as AnalysisInput['payment']['amount']).value).filter(Number.isFinite).sort((a,b)=>a-b);
    const median = values.length ? (values.length%2 ? values[(values.length-1)/2]! : (values[values.length/2-1]!+values[values.length/2]!)/2) : null;
    const deviation = median===null ? null : median===0 ? (target.value===0?0:null) : Math.round(Math.abs(target.value-median)/median*10000)/100;
    const outgoing = sent.filter(r=>typeof r.tx.Destination==='string');
    const counterparts=new Set(sender.records.filter(good).map(r => r.tx.Account === input.payment.account
      ? r.tx.Destination : r.tx.Destination === input.payment.account ? r.tx.Account : undefined).filter((v): v is string => typeof v === 'string'));
    const recent=sent.filter(r=>r.close_time_iso && Date.now()-Date.parse(r.close_time_iso)<=3_600_000).length;
    const times=sent.map(r=>Date.parse(r.close_time_iso ?? '')).filter(Number.isFinite);
    const spanHours=times.length>1?Math.max(1,(Math.max(...times)-Math.min(...times))/3_600_000):1;
    const assetMatches = typeof input.payment.amount !== 'string' && typeof input.intent?.amount === 'object' && input.intent.amount !== null
      ? input.intent.amount.currency===input.payment.amount.currency && (!input.intent.amount.issuer || input.intent.amount.issuer===input.payment.amount.issuer) : null;
    const intentAmount = input.intent?.amount;
    const amountMatches = intentAmount===undefined ? null : typeof intentAmount==='string'
      ? input.payment.amount===intentAmount : typeof input.payment.amount!=='string' && input.payment.amount.value===intentAmount.value;
    return {
      amountDeviation: deviation,
      firstTimeRecipient: sender.complete ? !outgoing.some(r=>r.tx.Destination===input.payment.destination) : null,
      senderActivity: sender.records.length, recipientActivity: recipient.records.length,
      paymentsPerHour: recent, unusualActivity: sender.complete ? recent>Math.max(5, sent.length/spanHours*3) : null,
      uniqueCounterparties: sender.complete ? counterparts.size : null,
      budgetUtilization: input.budget && (!input.budget.currency || input.budget.currency===target.currency) ? (input.budget.spent+target.value)/input.budget.limit : null,
      intentConsistency: { amount: amountMatches, recipient: input.intent?.destination===undefined ? null : input.intent.destination===input.payment.destination, currency: assetMatches },
      accountInfo: { senderExists: senderInfo.exists, recipientExists: recipientInfo.exists, senderBalanceXrp: senderInfo.balanceXrp, recipientBalanceXrp: recipientInfo.balanceXrp },
      historyComplete: sender.complete && recipient.complete
    };
  }
}
