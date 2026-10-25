import 'dotenv/config';
import { interpretWithJev } from './jev.js';
import type { Analytics, RuleResult } from './types.js';

if(!process.env.SYSTEM_ONE_API_KEY) throw new Error('Set SYSTEM_ONE_API_KEY before running the billable Jev sample.');
const metrics:Analytics={amountDeviation:3.2,firstTimeRecipient:true,senderActivity:42,recipientActivity:17,paymentsPerHour:1,unusualActivity:false,uniqueCounterparties:12,budgetUtilization:0.65,intentConsistency:{amount:true,recipient:true,currency:true},accountInfo:{senderExists:true,recipientExists:true,senderBalanceXrp:75,recipientBalanceXrp:20},historyComplete:true};
const rules:RuleResult={status:'PASS',violations:[],unknowns:[]};
const decision=await interpretWithJev({metrics,intent:{description:'Pay the contracted designer 25 XRP for the approved milestone',amount:'25000000',destination:'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'},rules});
if(!decision) throw new Error('Jev was not configured');
console.log(JSON.stringify({sample:'XRPL Testnet-style payment context',decision},null,2));
