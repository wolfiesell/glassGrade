export const SCHEMA_VERSION = 1 as const;

export type Network = 'mainnet' | 'testnet' | 'devnet';

/** What the "device" encodes into the QR code. Compact keys keep the QR small. */
export interface TxPayload {
  v: 1;
  net: Network;
  from: string;       // sender r-address
  to: string;         // destination r-address
  amt: string;        // amount in drops, as a string (XRP only for MVP)
  dt?: number;        // destination tag, if present
}

export interface AccountFacts {
  address: string;
  exists: boolean;                    // false if the account is not activated on the ledger
  balanceDrops?: string;
  ownerCount?: number;
  flags?: { requireDestTag: boolean; depositAuth: boolean };
  firstTxTimeUnix?: number;           // Unix seconds; undefined if no transactions
  funder?: string;                    // sender of the first incoming Payment
  recentTxTimesUnix: number[];        // up to 200, newest first, Unix seconds
  txCountSampled: number;
}

export interface FactsBundle {
  payload: TxPayload;
  sender: AccountFacts;
  recipient: AccountFacts;
  funder?: AccountFacts;                         // recipient's funder, one hop only
  senderHasPaidRecipientBefore: boolean;
  reserve: { baseDrops: string; incDrops: string };
  fetchedAtUnix: number;
  source: 'live' | 'fixture';
}

export type MetricId =
  | 'address_age'
  | 'dest_exists'
  | 'blacklist'
  | 'tx_velocity'
  | 'creation_context'
  | 'balance_percent'
  | 'new_to_user'
  | 'dest_tag_required';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Metric {
  id: MetricId;
  label: string;                                   // short, e.g. "Recipient age"
  value: number | string | boolean | null;         // raw measured value
  display: string;                                 // human text, e.g. "3 days old"
  severity: Severity;
  penalty: number;                                 // risk points contributed, >= 0
  explanation: string;                             // deterministic one-liner, safe to render
  available: boolean;                              // false if data was missing
}

export type Verdict = 'SIGN' | 'CAUTION' | 'REJECT';

export interface RiskAssessment {
  schemaVersion: typeof SCHEMA_VERSION;
  score: number;                                   // 0-100, higher = riskier
  verdict: Verdict;
  forcedBy?: MetricId;                             // set when a metric forces the verdict (e.g. blacklist)
  metrics: Metric[];
  computedAtUnix: number;
}

export interface Summary {
  headline: string;                                // <= 80 chars
  bullets: string[];                               // 2-4 items, each <= 140 chars
  recommendation: string;                          // 1 sentence, must agree with verdict
  source: 'ai' | 'template';
}

export interface AnalysisResult {
  payload: TxPayload;
  assessment: RiskAssessment;
  summary: Summary;
  dataSource: 'live' | 'fixture';
}
