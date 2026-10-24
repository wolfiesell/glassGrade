# GlassGrade

XRPL Commons Hackathon frontend — dark bento dashboard (shadcn-style + Tailwind).

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- shadcn-ready layout: `src/components/ui`, `src/lib/utils.ts`, `components.json`
- Path alias: `@/*` → `src/*`

## Run

```bash
npm install
npm run dev
```

## UI

`SafetyBento` (`src/components/ui/safety-bento.tsx`) is the purple dark bento dashboard for recipient risk — address age, blacklists, velocity, suspicious creation, balance share, familiarity, and more.

Demo data: `src/data/mockRecipient.ts`.

### Adding more shadcn components

```bash
npx shadcn@latest add button
```

Components install into `src/components/ui` — keep that folder so imports like `@/components/ui/...` stay consistent with shadcn conventions.
