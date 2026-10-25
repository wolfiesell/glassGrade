<img width="1672" height="941" alt="image" src="https://github.com/user-attachments/assets/b6e104d3-5d3d-4997-9428-abcc4cefe033" />



# IntentPay transaction intelligence

Backend MVP for analyzing proposed XRPL Testnet payments before the caller signs them. It does not hold keys, sign, submit, or authorize a payment. The deterministic rules engine owns `BLOCK` outcomes; Jev provides structured interpretation only.

## Setup

Requires Node.js 20+ (22+ recommended) and npm.

```sh
npm install
cp .env.example .env
# Set SYSTEM_ONE_API_KEY and SYSTEM_ONE_MODEL to an exact model name from the System One model directory.
npm run dev
```

The hosted Jev SDK versions are pinned to the current official package set: core 0.8.0, System One adapter 0.7.0, and Fetch transport 0.8.0. When Jev credentials are absent, analysis still runs and returns `jev: null`; with credentials configured, calls are billable. To make one sample Jev decision and print its measured inference latency, run `npm run jev:sample` after configuring credentials. The sample uses a fabricated XRPL Testnet-style payment context and never signs or submits it.

## API

`POST /analyze-transaction` accepts a proposed payment and optional intent, budget, and application records. XRP `amount` is given in drops, as required by XRPL transaction JSON; issued asset amounts use `{ "currency", "issuer", "value" }`.

```json
{
  "payment": {
    "account": "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    "destination": "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    "amount": "25000000",
    "invoiceId": "invoice-42"
  },
  "intent": {
    "destination": "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    "amount": "25000000",
    "invoiceId": "invoice-42"
  },
  "budget": { "limit": 100, "spent": 40, "currency": "XRP" },
  "applicationRecords": []
}
```

Response includes historical metrics, `rules.status` (`PASS`, `BLOCK`, or `INSUFFICIENT_DATA`), Jev's category/clarity/concern/review interpretation, a latency measurement, and a top-level decision. The top-level `ELIGIBLE_FOR_SIGNING` means only that the supplied deterministic checks passed and Jev did not request extra contextual review. It is not approval or signing. `BLOCKED` cannot be changed by Jev. Missing original intent or budget leaves the rules insufficient unless the request carries a complete authorization source.

`requiredFields` may name `invoiceId` and/or `taskId`; missing values produce a hard rule block. Matching invoice/task identifiers in `applicationRecords` are blocked as duplicates. Supply records from the application system; the service does not persist application state.

## XRPL history and limits

The service reads validated `account_tx` history for the sender and recipient from the configured Testnet WebSocket. A capped or paginated history is marked incomplete; recipient novelty, counterparty counts, and history-derived conclusions remain unknown when completeness cannot be established. XRPL failures return HTTP 502 with a request ID. Issued assets are compared by currency and issuer; raw amount comparisons use decimal strings to avoid floating point comparisons in rules. Historical numeric metrics are approximate JavaScript numbers.

## Ledger Wallet CLI connector

The connector runs the configured Ledger Wallet CLI executable (by default
`C:\Users\HEET\ledger-live\apps\wallet-cli\dist\windows-x64\cli.exe`) directly with shell execution disabled. It does not copy Ledger Live code, handle recovery phrases, or access private keys. The executable must be built separately; a missing executable is reported as an error.

The CLI runs on the backend host and inherits that host's `SPECULOS_ADDRESS` and `SPECULOS_API_PORT` environment variables. Defaults are `127.0.0.1` and `5000`. For a Speculos emulator in a friend's Docker container, the backend host must be able to reach the friend's Docker host on its published Speculos API port:

1. Connect both computers to a private Tailscale network (or an equivalent private VPN). Do not expose Speculos port 5000 to the public internet; restrict access with the VPN ACL and the friend's host firewall so only the backend host can reach it.
2. On the friend's computer, publish the Speculos API port from the container to the host (commonly container port 5000 to host port 5000). Their Docker setup must bind the API to an interface reachable from the VPN, not only to container-local localhost.
3. On the computer running this project's backend, set `SPECULOS_ADDRESS` to the friend's Tailscale IP or private DNS name and `SPECULOS_API_PORT` to the Docker host port. Do not include `http://` in the address. Restart `npm run dev` after changing `.env`.
4. From the backend computer, verify `Test-NetConnection <friend-tailscale-ip> -Port 5000` succeeds, then use **Discover Ledger accounts** in the UI. If discovery succeeds, use the returned account label for dry-run/send.

`POST /ledger/xrp/review` does not contact Speculos: it gets XRPL history and a separate Jev advisory. Discovery, dry-run, and send call the Wallet CLI and therefore need the Speculos tunnel. Dry-run does not broadcast. Send may broadcast on Testnet after the emulator/device approves.

The connector is Testnet-only:

- `POST /ledger/xrp/discover` runs `account discover --network ripple:testnet --output json`.
- `POST /ledger/xrp/review` runs the existing XRPL analysis and JEV advisory routing for the exact proposal without signing or broadcasting.
- `POST /ledger/xrp/dry-run` validates a proposal and runs `send ... --dry-run --output json`; it does not sign or broadcast.
- `POST /ledger/xrp/send` is the separate action for a real send. The Ledger device must physically approve the transaction.

Proposal JSON is `{ "network": "xrp:testnet", "sender": "<classic address>", "account": "<discovered session label>", "recipient": "<classic address>", "amount": "<XRP decimal>", "destinationTag": 42 }`. `amount` supports up to six decimal places. The response identifies the Ledger Wallet CLI/XRPL Testnet data source and returns the CLI transaction status/hash when supplied. JEV's risk explanation remains separate from these XRPL facts and does not guarantee that an address is trustworthy.

Recommended flow: discover accounts, call `/ledger/xrp/review`, show the returned deterministic rules and JEV advisory result, optionally call `/ledger/xrp/dry-run`, then require a separate user action for `/ledger/xrp/send`. A review result never authorizes or signs a transaction.

Application records and budget are caller supplied and are not persisted. An XRPL lookup is not a simulation of future execution and may not reflect the account's state at the time of later signing.

## Development

```sh
npm test
npm run build
```

To use the dashboard, run `npm run dev` for the API and `npm run dev:frontend` in a second terminal, then open `http://127.0.0.1:5173`. It opens on **XRPL review**, which uses the live API; choose **Load Testnet sample**, then **Review with Jev** or **Analyze transaction**. Enter both budget values to run deterministic budget checks; without a supplied budget, rules intentionally return `INSUFFICIENT_DATA`. The **Live data** tab shows metrics from the last successful review in that browser session. Jev requests may be billable. XRPL history pagination is reported as incomplete, not treated as clean history. The sample overview, signals, reputation, activity, and address lookup are explicitly labeled demo data and are not live API results. Vite proxies API routes to `http://127.0.0.1:3000`.

## QR verification and Vercel frontend

The QR URL should target `/verify.html#tx=<serialized-unsigned-xrpl-transaction>&net=testnet&code=A018`. The page sends that payload to `POST /ledger/xrp/qr-review`, which accepts unsigned native XRP `Payment` proposals only, decodes them on the backend, and returns XRPL metrics and a Jev advisory. This flow does not sign or broadcast. The full hexadecimal `tx` value is required.

Budget context: add `&limit=<XRP>` to the QR link to supply the owner's spending limit (or set `QR_BUDGET_LIMIT_XRP` on the backend, which takes precedence). The backend never trusts a spent amount from the link: it measures "spent" from the sender's validated XRPL Testnet history (successful outgoing native XRP payments, delivered amounts, over the last `QR_BUDGET_WINDOW_HOURS`, default 24) and passes `{ limit, spent }` to the rules. The response includes a `budget` object with the limit, its source, the measured spent amount, the window, and whether the history covered the whole window; if it did not, the budget stays unknown and the rules report `INSUFFICIENT_DATA`.

Vercel hosts only the static frontend. Keep the Express API on a Tailscale-connected machine that can reach Speculos, expose the API to the tailnet over HTTPS, set Vercel's `VITE_API_BASE_URL` to that API URL, and set the backend's `CORS_ALLOWED_ORIGINS` to the exact Vercel site origin. The device/browser opening the QR must also be connected to the tailnet. Do not publish the wallet CLI API to the public internet.

The unit tests cover XRP drop conversion, missing data, required fields, duplicate identifiers, recipient mismatch, and budget enforcement. The `jev:sample` command reports the measured inference time for a real SDK request; no latency target is promised.
