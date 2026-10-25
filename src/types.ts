import { z } from 'zod';

const address = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'Invalid XRPL classic address');
export const paymentSchema = z.object({
  account: address,
  destination: address,
  amount: z.union([z.string().regex(/^\d+$/), z.object({ currency: z.string().min(3).max(40), issuer: address, value: z.string().regex(/^\d+(\.\d+)?$/) })]),
  invoiceId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  requiredFields: z.array(z.enum(['invoiceId', 'taskId'])).default([])
});
export const intentSchema = z.object({ destination: address.optional(), amount: z.union([z.string(), z.object({ currency: z.string(), issuer: address.optional(), value: z.string() })]).optional(), invoiceId: z.string().optional(), taskId: z.string().optional() }).optional();
export const budgetSchema = z.object({ limit: z.number().positive(), spent: z.number().nonnegative(), currency: z.string().optional(), issuer: address.optional() }).optional();
export const applicationRecordSchema = z.object({ invoiceId: z.string().optional(), taskId: z.string().optional(), status: z.enum(['pending', 'paid', 'complete']).optional() });
export const analyzeSchema = z.object({ payment: paymentSchema, intent: intentSchema, budget: budgetSchema, applicationRecords: z.array(applicationRecordSchema).max(1000).optional() });
export type PaymentInput = z.infer<typeof paymentSchema>;
export type IntentInput = z.infer<NonNullable<z.infer<typeof intentSchema>>>;
export type BudgetInput = z.infer<NonNullable<z.infer<typeof budgetSchema>>>;
export type AnalysisInput = z.infer<typeof analyzeSchema>;
export type RuleStatus = 'PASS' | 'BLOCK' | 'INSUFFICIENT_DATA';
export type RuleResult = { status: RuleStatus; violations: string[]; unknowns: string[] };
export type Amount = { value: number; currency: string; issuer?: string };
export type Analytics = {
  amountDeviation: number | null; firstTimeRecipient: boolean | null;
  senderActivity: number | null; recipientActivity: number | null; paymentsPerHour: number | null;
  unusualActivity: boolean | null; uniqueCounterparties: number | null;
  budgetUtilization: number | null; intentConsistency: { amount: boolean | null; recipient: boolean | null; currency: boolean | null };
  accountInfo: { senderExists: boolean | null; recipientExists: boolean | null; senderBalanceXrp: number | null; recipientBalanceXrp: number | null };
  historyComplete: boolean;
};
