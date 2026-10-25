// Budget "spent" for the QR review, measured from XRPL history instead of trusted from the link.

export type BudgetHistoryRecord = {
  tx: Record<string, unknown>;
  meta?: Record<string, unknown>;
  validated?: boolean;
  close_time_iso?: string;
};

/** Native XRP the account sent in validated, successful Payments closed at or after `sinceMs`. */
export function sumOutgoingXrpSince(records: BudgetHistoryRecord[], account: string, sinceMs: number): number {
  let drops = 0n;
  for (const r of records) {
    if (r.validated === false || r.tx.TransactionType !== 'Payment' || r.tx.Account !== account) continue;
    if (r.meta?.TransactionResult !== 'tesSUCCESS') continue;
    const closed = Date.parse(r.close_time_iso ?? '');
    if (!Number.isFinite(closed) || closed < sinceMs) continue;
    // delivered_amount is what actually arrived; Amount/DeliverMax is only the requested maximum.
    const delivered = r.meta?.delivered_amount ?? r.tx.DeliverMax ?? r.tx.Amount;
    if (typeof delivered === 'string' && /^\d+$/.test(delivered)) drops += BigInt(delivered);
  }
  return Number(drops) / 1_000_000;
}

/** True once the history reaches back past the window start (or to the start of the account). */
export function historyCoversWindow(records: BudgetHistoryRecord[], hasMore: boolean, sinceMs: number): boolean {
  if (!hasMore) return true;
  const oldest = records.at(-1);
  const closed = Date.parse(oldest?.close_time_iso ?? '');
  return Number.isFinite(closed) && closed < sinceMs;
}
