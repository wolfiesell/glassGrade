import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const classicAddress = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'Invalid XRP classic address');
const xrpAmount = z.string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, 'XRP amount must be a decimal with up to 6 places')
  .refine(value => Number(value) > 0, 'XRP amount must be greater than zero');

export const xrpPaymentProposalSchema = z.object({
  network: z.literal('xrp:testnet'),
  sender: classicAddress,
  // Wallet CLI account labels are created by account discovery and are not private keys.
  account: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, 'Invalid Wallet CLI account label'),
  recipient: classicAddress,
  amount: xrpAmount,
  destinationTag: z.number().int().min(0).max(4_294_967_295).optional(),
});

export type XrpPaymentProposal = z.infer<typeof xrpPaymentProposalSchema>;
type CliJson = Record<string, unknown>;
type CliRunner = (args: readonly string[]) => Promise<{ stdout: string; stderr: string }>;

const cliPath = process.env.LEDGER_WALLET_CLI_PATH ??
  'C:\\Users\\HEET\\ledger-live\\apps\\wallet-cli\\dist\\windows-x64\\cli.exe';

async function runWalletCli(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(cliPath, [...args], {
      shell: false,
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 1_048_576,
    });
  } catch (error) {
    const detail = error as { stderr?: string; stdout?: string; message?: string };
    const output = detail.stderr?.trim() || detail.stdout?.trim();
    throw new Error(`Ledger Wallet CLI failed${output ? `: ${output}` : `: ${detail.message ?? 'unknown error'}`}`);
  }
}

function readJsonOutput(stdout: string): CliJson {
  const values = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => {
    try {
      const value: unknown = JSON.parse(line);
      return typeof value === 'object' && value !== null ? [value as CliJson] : [];
    } catch {
      return [];
    }
  });
  const result = values.at(-1);
  if (!result) throw new Error('Ledger Wallet CLI returned no JSON result');
  if (result.status === 'error' || result.error) {
    const error = typeof result.error === 'object' && result.error !== null
      ? (result.error as { message?: unknown }).message
      : result.error;
    throw new Error(`Ledger Wallet CLI error: ${String(error ?? 'unknown error')}`);
  }
  return result;
}

export function xrpAmountToDrops(amount: string): string {
  const [whole, fraction = ''] = amount.split('.');
  return `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '');
}

export function proposalAnalysisInput(proposal: XrpPaymentProposal) {
  return {
    payment: {
      account: proposal.sender,
      destination: proposal.recipient,
      amount: xrpAmountToDrops(proposal.amount),
      requiredFields: [],
    },
    intent: {
      destination: proposal.recipient,
      amount: xrpAmountToDrops(proposal.amount),
    },
  };
}

export function discoveryCliArgs(): readonly string[] {
  return ['account', 'discover', '--network', 'ripple:testnet', '--output', 'json'];
}

export function accountAddressCliArgs(account: string): readonly string[] {
  return ['receive', '--account', account, '--no-verify', '--output', 'json'];
}

export function paymentCliArgs(proposal: XrpPaymentProposal, dryRun: boolean): readonly string[] {
  return [
    'send',
    '--account', proposal.account,
    '--to', proposal.recipient,
    '--amount', `${proposal.amount} XRP`,
    ...(proposal.destinationTag === undefined ? [] : ['--destination-tag', String(proposal.destinationTag)]),
    ...(dryRun ? ['--dry-run'] : []),
    '--output', 'json',
  ];
}

export async function discoverXrpAccounts(runner: CliRunner = runWalletCli): Promise<{
  status: 'discovered';
  accounts: unknown;
  dataSource: string;
}> {
  const result = readJsonOutput((await runner(discoveryCliArgs())).stdout);
  return { status: 'discovered', accounts: result.accounts ?? [], dataSource: 'Ledger Wallet CLI account discovery on XRPL Testnet' };
}

async function executePayment(proposal: XrpPaymentProposal, dryRun: boolean, runner: CliRunner): Promise<{
  status: 'prepared' | 'broadcasted';
  dryRun: boolean;
  transaction: CliJson;
  dataSource: string;
}> {
  const accountResult = readJsonOutput((await runner(accountAddressCliArgs(proposal.account))).stdout);
  if (accountResult.address !== proposal.sender) {
    throw new Error(`Wallet CLI account "${proposal.account}" does not resolve to the proposed sender address`);
  }
  const transaction = readJsonOutput((await runner(paymentCliArgs(proposal, dryRun))).stdout);
  const txHash = transaction.tx_hash;
  return {
    status: dryRun ? 'prepared' : 'broadcasted',
    dryRun,
    transaction: {
      ...transaction,
      ...(typeof txHash === 'string' ? { txHash } : {}),
    },
    dataSource: 'Ledger Wallet CLI and XRPL Testnet',
  };
}

export function dryRunXrpPayment(proposal: XrpPaymentProposal, runner: CliRunner = runWalletCli) {
  return executePayment(proposal, true, runner);
}

export function sendXrpPayment(proposal: XrpPaymentProposal, runner: CliRunner = runWalletCli) {
  return executePayment(proposal, false, runner);
}
