# Historical architecture proposal — original GlassGrade prototype

> **This document is archived and does not describe the current implementation.** It records the original browser-only hackathon plan. The current app has an Express backend, XRPL Testnet analysis, Jev advisory, and a Ledger Wallet CLI connector. Use `README.md` and the current source code for actual behavior; do not treat this proposal as the source of truth.

Original audience: the human developers and AI coding agents working on the initial prototype. The sections below are retained as historical context.

---

## 0. Project summary

A browser-only web app that explains, in plain language, how risky an XRPL payment is **before the user signs it** on a LEDGER hardware wallet.

Two demo surfaces:

1. **Device emulator** (`/`): a custom-coded, Ledger-style screen mockup. It is NOT a real Ledger emulation. It shows a pending transaction and a QR code. The QR code goes to the analysis page described in the second item.(NFC to get to analysis page is a stretch goal). The plan has changed, and we are currently working on using the real official emulator for the ledger wallet.
2. **Analysis page** (`/#/a/<payload>`): opened by scanning the QR. Fetches public XRPL data, computes a deterministic risk score, shows an AI-written plain-English summary and a verdict.

Hard constraints:

| Constraint | Rule |
|---|---|
| No accounts, no backend | Everything runs client-side. No login, no database, no server we operate. |
| Privacy | Transaction details travel in the URL **hash fragment** (never sent to a server). No analytics. |
| Time budget | 24 hours. Prefer the simplest thing that works. Cut order is in section 12. |
| Network | XRPL **mainnet, read-only** for analysis. Testnet accounts have fake ages and are useless for this. |
| Scope | XRP `Payment` transactions only for MVP. Token payments are a stretch goal. |

---

## 1. Key decisions (do not relitigate without updating this file)

1. **The verdict is computed deterministically. The AI only explains it.** `scoring` produces `verdict`; `ai-summary` writes the narrative and must agree with it. If the AI output conflicts or fails, the template summary is used. Rationale: the verdict must be reproducible and cannot be talked into "SIGN" by text.
2. **On-chain free text is untrusted input.** Memos, domains, and any attacker-controlled strings are never sent to the AI and never rendered as HTML. See section 9.
3. **Fail safe.** If critical data is missing (age or blacklist unavailable), the verdict cannot be `SIGN`. Minimum is `CAUTION`.
4. **Modules talk only through `src/core/schema.ts`.** No module imports another module's internals.
5. **Pure functions wherever possible.** Only `xrpl-data` and `ai-summary` touch the network. `metrics`, `scoring`, `payload`, `blacklist` are pure and unit-tested.
6. **Everything is fixture-able.** The whole pipeline runs offline from `fixtures/` so the demo survives bad wifi.

---

## 2. Tech stack

- TypeScript (strict mode), Vite, React.
- `xrpl` (xrpl.js) for ledger access. `qrcode` (or equivalent) for QR generation. Vitest for tests.
- Pin exact versions in `package.json` at install time. Do not add dependencies without noting them in section 13.
- Hosting: any static host (Vercel, Netlify, GitHub Pages). Must support SPA hash routing (no server config needed).

---

## 3. Repository layout

```
/
├─ ARCHITECTURE.md                 <- this file
├─ src/
│  ├─ core/
│  │  ├─ schema.ts                 <- ALL shared types + constants (section 5)
│  │  └─ errors.ts                 <- AnalysisError codes
│  ├─ config/
│  │  ├─ app.config.ts             <- endpoints, timeouts, feature flags
│  │  └─ scoring.config.ts         <- thresholds and penalties (section 7)
│  ├─ modules/
│  │  ├─ payload/                  <- encode/decode URL payload
│  │  ├─ xrpl-data/                <- live + fixture data fetching
│  │  ├─ metrics/                  <- raw facts -> Metric[]
│  │  ├─ blacklist/                <- static flagged-address lookup
│  │  ├─ scoring/                  <- Metric[] -> RiskAssessment
│  │  └─ ai-summary/               <- RiskAssessment -> Summary
│  ├─ app/
│  │  └─ analyze.ts                <- orchestrator (section 6)
│  ├─ ui/
│  │  ├─ emulator/                 <- Ledger-style mock device + QR screen
│  │  ├─ analysis/                 <- the analysis page
│  │  └─ shared/                   <- buttons, badges, layout
│  └─ main.tsx                     <- hash router: "/" and "/a/:payload"
├─ fixtures/
│  ├─ scenarios/                   <- one JSON per demo scenario (section 10)
│  └─ README.md
└─ tests/                          <- mirrors src/modules
```

Each module directory contains: `index.ts` (the ONLY public entry), implementation files, and a `README.md` stating its contract in 10 lines or less.

---

## 4. Dependency rules (enforced in review)

```
ui  ->  app  ->  modules (via index.ts only)  ->  core
config is importable by anything.
modules may import: core, config. Never another module.
app/analyze.ts is the ONLY place modules are composed.
```

---

## 5. Shared schema (`src/core/schema.ts`)

This is the canonical contract. Copy exactly. Changing it requires all three owners to agree.

```ts
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
```

---

## 6. Pipeline and orchestrator

```
QR/URL hash
   |
   v
payload.decode()                     -> TxPayload
   |
   v
xrpl-data.fetchFacts(payload)        -> FactsBundle        (network; or fixture)
   |
   v
metrics.compute(bundle)              -> Metric[]           (pure)
blacklist.check(address)             -> BlacklistHit|null  (pure)   [folded into Metric[] by metrics]
   |
   v
scoring.assess(metrics)              -> RiskAssessment     (pure)
   |
   v
ai-summary.summarize(assessment, payload) -> Summary       (network; falls back to template)
   |
   v
ui/analysis renders AnalysisResult
```

`src/app/analyze.ts` exposes one function and takes its dependencies as arguments so tests and fixtures can swap them:

```ts
export interface AnalyzeDeps {
  fetchFacts: (p: TxPayload) => Promise<FactsBundle>;
  summarize: (a: RiskAssessment, p: TxPayload) => Promise<Summary>;
  now: () => number;
}
export function analyzeTransaction(payload: TxPayload, deps: AnalyzeDeps): Promise<AnalysisResult>;
```

---

## 7. Module contracts

### 7.1 `payload` (owner: Wolfgang)
- `encode(p: TxPayload): string` -> JSON -> UTF-8 -> base64url.
- `decode(s: string): TxPayload` -> throws `AnalysisError('BAD_PAYLOAD')` on invalid input.
- Validate: `v === 1`, both addresses match XRPL classic address format, `amt` is a positive integer string.
- URL format: `https://<host>/#/a/<encoded>`.

### 7.2 `xrpl-data` (owner: Jag)
- `fetchFacts(payload): Promise<FactsBundle>`.
- Live mode uses xrpl.js against the endpoint in `app.config.ts` (QuickNode URL if set, public endpoint otherwise).
- Fixture mode (`VITE_USE_FIXTURES=true`) loads `fixtures/scenarios/*.json` keyed by recipient address.
- Required ledger calls: `account_info` (sender, recipient), `account_tx` (recipient: first tx via forward order with limit 1; last 200 tx; sender: look for prior Payments to recipient), `server_info` for reserves.
- Caps: every `account_tx` query uses `limit <= 200`. Total timeout 8s. Cache results in memory by address for the session.
- Convert Ripple-epoch times to Unix seconds before returning (use xrpl.js helper). **Verify exact API shapes against xrpl.org docs before coding; do not guess field names.**
- Partial failure must not throw: return what was fetched, set `exists`/fields accordingly, and let `metrics` mark metrics `available: false`.

### 7.3 `blacklist` (owner: Jag)
- Data file: `src/modules/blacklist/data/flagged.json`:
  ```json
  { "updated": "ISO-date", "entries": [ { "address": "r...", "source": "https://...", "reason": "..." } ] }
  ```
- **Every entry must have a real, checkable source URL. Never invent entries.** Agents: do not populate this file from memory; leave it empty or ask a human.
- `check(address): { address, source, reason } | null`.
- Optional second file `labels.json` for known-exchange addresses, same rule.

### 7.4 `metrics` (owner: Jag)
- `compute(bundle: FactsBundle): Metric[]`. Pure. Always returns one `Metric` per `MetricId` (set `available: false` if inputs are missing).
- Metric definitions and penalties are in the table below. All numbers live in `src/config/scoring.config.ts`, not hardcoded in logic.

| id | What it measures | Initial penalty rule (tunable) |
|---|---|---|
| `address_age` | Days since recipient's first transaction | < 1 day: 30, < 7 days: 20, < 30 days: 10, else 0 |
| `dest_exists` | Recipient account not yet activated | not exists: 25 |
| `blacklist` | Recipient is in `flagged.json` | hit: 100 and forces REJECT |
| `tx_velocity` | Median gap between recipient's recent txs (needs >= 20 sampled) | median gap < 60s: 15; fewer than 5 sampled: info only, 0 |
| `creation_context` | Who funded the recipient | funder blacklisted: 40; funder age < 7 days: 15; funder unknown: 5; funder labeled exchange: 0 |
| `balance_percent` | Amount / sender's spendable balance (balance minus base reserve minus owner reserves) | > 90%: 20; > 50%: 10 |
| `new_to_user` | Sender never paid this recipient before | true: 10 |
| `dest_tag_required` | Recipient requires a destination tag and `dt` is missing | true: 25 |

Compute reserves from `FactsBundle.reserve` and `ownerCount`. Do not hardcode reserve amounts.

### 7.5 `scoring` (owner: Jag)
- `assess(metrics: Metric[], now: number): RiskAssessment`. Pure.
- `score = min(100, sum(penalty))`.
- Verdict thresholds (in `scoring.config.ts`): `score < 30` -> `SIGN`; `30..59` -> `CAUTION`; `>= 60` -> `REJECT`.
- Overrides: any metric with `forcedBy` behavior (blacklist hit) -> `REJECT`. If `address_age` or `blacklist` has `available: false`, verdict is at least `CAUTION`.
- Golden tests: each fixture scenario has an `expectedVerdict`; CI fails if scoring drifts.

### 7.6 `ai-summary` (owner: Heet)
- Provider interface so the model/API can be swapped:
  ```ts
  export interface SummaryProvider {
    name: string;
    generate(input: SummaryInput, signal: AbortSignal): Promise<unknown>;
  }
  export interface SummaryInput {
    verdict: Verdict;
    score: number;
    amountXrp: string;
    metrics: Pick<Metric, 'id' | 'label' | 'display' | 'severity' | 'explanation'>[];
  }
  ```
- `summarize(a, p): Promise<Summary>`: build `SummaryInput` (sanitized, section 9), call the provider with a 4s timeout, validate the response against the `Summary` shape, and enforce: `recommendation` must agree with `verdict`. On any failure, return the **template summary** (`source: 'template'`).
- Prompt rules: plain English at roughly an 8th-grade reading level, no jargon, no financial advice language beyond the recommendation, never claim certainty, never contradict the verdict, output JSON only.
- Providers: `mockProvider` (fixtures/tests) and the real one. **OPEN: which fast-inference provider the team means by "jev" is unconfirmed (see section 13).** Everything else depends only on the interface.
- API key: this is a client-only app, so any key shipped in the bundle is public. Use a throwaway key with a spend limit, or a bring-your-own-key field stored in `sessionStorage`. Never commit keys.

---

## 8. UI contracts

### 8.1 Device emulator (`ui/emulator`, owner: Wolfgang)
- Styled mock hardware wallet. Screens in order: (1) "Review transaction" (amount, truncated recipient), (2) "Verify on phone" with the QR code from `payload.encode`, (3) Approve / Reject buttons.
- Accepts a `TxPayload` from a small "scenario picker" so the demo can switch cases instantly.
- Clearly labeled as a demonstration mock. It does not sign anything.
- **NFC (stretch):** Web NFC works only in Chrome on Android over HTTPS. Implementation is a pre-written NFC tag containing a static URL to a fixture scenario. No runtime NFC code required for MVP.

### 8.2 Analysis page (`ui/analysis`, owner: Wolfgang, content from Heet)
- Top: large verdict banner. `SIGN` = "Looks OK to sign", `CAUTION` = "Double-check before signing", `REJECT` = "Do not sign". Use icon + text + color, never color alone.
- Then: `summary.headline`, bullets, recommendation.
- Then: metric list sorted by `penalty` descending, each showing `label`, `display`, `severity`.
- Collapsible "Technical details": raw values and data source (`live` or `fixture`).
- States: loading (skeleton), partial data (banner: "Some checks unavailable"), error (clear message + retry).
- Render all strings as text, never as HTML.

---

## 9. Security and trust rules

1. Chain data is hostile. Memos, domain fields, and any free text are excluded from `SummaryInput` and are never rendered as markup.
2. `SummaryInput` contains only enums, numbers, and our own deterministic explanation strings.
3. Transaction data lives in the hash fragment only. Do not log payloads or addresses to any third party.
4. No secrets in the repo. `.env.local` is gitignored; `VITE_*` values are visible in the browser, so use throwaway keys.
5. The AI cannot change the verdict. Reject any AI output that disagrees with it.

---

## 10. Fixtures and demo scenarios

`fixtures/scenarios/<name>.json` contains: `payload`, `factsBundle`, `expectedVerdict`. Minimum set:

| Scenario | Recipient | Expected verdict |
|---|---|---|
| `safe` | A well-known, long-lived exchange or institutional address (real, human-verified) | `SIGN` |
| `new-risky` | A brand-new account we create and fund ourselves | `CAUTION` or `REJECT` |
| `flagged` | An address from a public scam report with a source URL in `flagged.json` | `REJECT` |

Fixtures are captured from live responses once, then committed. Agents: never fabricate fixture data; capture it or ask a human.

---

## 11. Ownership and working agreements

| Area | Owner |
|---|---|
| `xrpl-data`, `blacklist`, `metrics`, `scoring`, scoring config | Jag |
| `ai-summary`, prompt, template summaries, verdict copy | Heet |
| `payload`, `ui/*`, `main.tsx`, hosting, QR/NFC | Wolfgang |
| `core/schema.ts`, this file | Changes need all three |

- **Schema freeze at hour 2.** After that, additive changes only, announced to everyone.
- Work against `fixtures` first; wire live data second.
- Small PRs, merge to `main` often. Every module ships with at least one unit test.
- Commit message prefix is the module name, e.g. `scoring: ...`.

---

## 12. Timeline and cut order

| Hours | Goal |
|---|---|
| 0-2 | Agree and freeze `schema.ts`, scaffold repo, stub every module to return fixture data |
| 2-10 | Each owner builds their module against fixtures |
| 10-16 | Integrate in `analyze.ts`, switch to live data, run the 3 scenarios |
| 16-20 | Polish copy and UI, tune scoring against golden tests, capture final fixtures |
| 20-24 | Deploy, rehearse demo, record a backup video, rest |

**If behind, cut in this order:** NFC -> live AI (use template summaries) -> `creation_context` -> `tx_velocity` -> live blacklist expansion. Never cut: `payload`, `address_age`, `balance_percent`, `blacklist`, the verdict banner.

---

## 13. Open questions and dependency log

- [ ] **"jev":** what is it, and does it expose an API we can call from a browser? (blocks only the real `SummaryProvider`)
- [ ] QuickNode XRPL endpoint: does it support the calls above, and what are its rate limits? Use a throwaway key.
- [ ] Blacklist sources: which public lists will we cite, and are they free to use?
- [ ] Confirm exact `account_tx` response fields and reserve fields against xrpl.org before `xrpl-data` is merged.
- Dependencies added: _(list here as they are added)_

---

## 14. Art for Front End
1. Shariva needs to push the designs she made for the front end. Jag will use that to create the front end design.

## 14. Definition of done (for the demo)

1. Scanning the emulator's QR opens the analysis page with the correct transaction.
2. All three scenarios produce the expected verdict, live and from fixtures.
3. Every verdict has a plain-English summary; with the network off, the template summary appears.
4. No account creation, no backend, no secrets in the repo.
5. `ARCHITECTURE.md` still matches the code.
