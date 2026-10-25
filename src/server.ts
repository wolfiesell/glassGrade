import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { analyzeSchema } from './types.js';
import { evaluateRules, parseAmount } from './rules.js';
import { XrplAnalyticsService } from './xrpl.js';
import { interpretWithJev } from './jev.js';
import { discoverXrpAccounts, dryRunXrpPayment, proposalAnalysisInput, sendXrpPayment, xrpPaymentProposalSchema } from './ledger-wallet.js';

const app=express();
app.use(express.json({limit:'32kb'}));
const xrpl=new XrplAnalyticsService();
const serviceInfo = {
  service: 'IntentPay transaction intelligence',
  routes: {
    health: 'GET /health',
    analyzeTransaction: 'POST /analyze-transaction',
    xrpDiscovery: 'POST /ledger/xrp/discover',
    xrpReview: 'POST /ledger/xrp/review',
    xrpDryRun: 'POST /ledger/xrp/dry-run',
    xrpSend: 'POST /ledger/xrp/send',
  },
  mode: 'XRPL Testnet only; Ledger signing requires the local Wallet CLI and physical device approval',
};
app.get('/', (_req, res) => res.json({ ...serviceInfo, status: 'ok' }));
app.get('/api/info', (_req, res) => res.json(serviceInfo));
app.get('/health',(_req,res)=>res.json({status:'ok'}));
app.post('/ledger/xrp/discover', async (_req, res) => {
  try {
    res.json(await discoverXrpAccounts());
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Ledger Wallet CLI error';
    res.status(502).json({ error: 'XRP account discovery failed', detail });
  }
});
app.post('/ledger/xrp/dry-run', async (req, res) => {
  const parsed = xrpPaymentProposalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid XRP Testnet payment proposal', details: parsed.error.issues });
  try {
    res.json(await dryRunXrpPayment(parsed.data));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Ledger Wallet CLI error';
    res.status(502).json({ error: 'XRP dry run failed', detail });
  }
});
app.post('/ledger/xrp/review', async (req, res) => {
  const parsed = xrpPaymentProposalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid XRP Testnet payment proposal', details: parsed.error.issues });
  const requestId = randomUUID();
  try {
    const input = proposalAnalysisInput(parsed.data);
    const metrics = await xrpl.analyze(input);
    const rules = evaluateRules(input, metrics);
    let jev = null;
    let jevError: string | undefined;
    try {
      jev = await interpretWithJev({ metrics, intent: input.intent, rules });
    } catch {
      jevError = 'Jev advisory service unavailable';
    }
    const decision = rules.status === 'BLOCK' ? 'BLOCKED'
      : rules.status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA'
      : !jev || jev.requiresReview ? 'HUMAN_REVIEW' : 'ELIGIBLE_FOR_SIGNING';
    res.json({
      requestId,
      network: 'xrp:testnet',
      proposal: parsed.data,
      metrics,
      rules,
      jev,
      jevError,
      decision,
      xrplDataSource: process.env.XRPL_WS_URL ?? 'wss://s.altnet.rippletest.net:51233',
      disclaimer: 'JEV is advisory and separate from XRPL facts. No address is guaranteed trustworthy. Review the exact transaction on the Ledger device.',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown XRPL service error';
    res.status(502).json({ error: 'XRP Testnet review could not complete', requestId, detail });
  }
});
app.post('/ledger/xrp/send', async (req, res) => {
  const parsed = xrpPaymentProposalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid XRP Testnet payment proposal', details: parsed.error.issues });
  try {
    res.json({
      ...(await sendXrpPayment(parsed.data)),
      approval: 'The Ledger device must physically approve this transaction before it is signed and broadcast.',
      warning: 'JEV risk interpretation is separate from XRPL transaction facts and does not guarantee the recipient is trustworthy.',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Ledger Wallet CLI error';
    res.status(502).json({ error: 'XRP send failed', detail });
  }
});
app.post('/analyze-transaction',async(req,res)=>{
  const requestId=randomUUID();
  const parsed=analyzeSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid request',details:parsed.error.issues.map(i=>({path:i.path,message:i.message})),requestId});
  try {
    const input=parsed.data;
    const metrics=await xrpl.analyze(input);
    const rules=evaluateRules(input,metrics);
    let jev=null, jevError:string|undefined;
    try { jev=await interpretWithJev({metrics,intent:input.intent,rules}); }
    catch { jevError='Jev advisory service unavailable'; }
    const decision=rules.status==='BLOCK'?'BLOCKED':rules.status==='INSUFFICIENT_DATA'?'INSUFFICIENT_DATA':!jev||jev.requiresReview?'HUMAN_REVIEW':'ELIGIBLE_FOR_SIGNING';
    res.json({requestId,payment:{amount:parseAmount(input.payment.amount)},metrics,rules,jev,decision,jevError,
      disclaimer:'Eligibility is an analysis result. It is not approval, signing, or a guarantee that a transaction is safe.'});
  } catch(error) {
    const message=error instanceof Error?error.message:'Unknown XRPL service error';
    res.status(502).json({error:'Transaction analysis could not complete because XRPL data was unavailable',requestId,detail:message});
  }
});
const port=Number(process.env.PORT??3000);
const server=app.listen(port,()=>console.log(`IntentPay intelligence API listening on ${port}`));
const shutdown=async()=>{server.close();await xrpl.close();process.exit(0);};
process.on('SIGINT',()=>void shutdown()); process.on('SIGTERM',()=>void shutdown());
