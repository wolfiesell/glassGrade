# GlassGrade


<img width="1672" height="941" alt="image" src="https://github.com/user-attachments/assets/1e2387f4-df5d-4902-9d3c-9dd43e818389" />


XRPL Commons Hackathon — browser-only transaction safety demo.

`ARCHITECTURE.md` is the full application plan (device → QR → analysis pipeline).

## Run locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

- **`/`** — GlassGrade safety dashboard (frontend)
- **`/#/wallet`** — Ledger-style wallet emulator mock

```bash
npm run build
npm run preview
```

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Three.js celestial sphere background
- shadcn-ready layout: `src/components/ui`, `src/lib/utils.ts`, `components.json`
- Path alias: `@/*` → `src/*`

## Frontend

`SafetyBento` / `GlassGradeDashboard` — purple dark bento dashboard for recipient risk (demo data in `src/data/mockRecipient.ts`).

`WalletDemo` (`src/ui/emulator`) — interactive Ledger-style review mock with QR placeholder. Not a real device; does not sign.

### Adding more shadcn components

```bash
npx shadcn@latest add button
```
