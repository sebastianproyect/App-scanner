# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # tsc + vite build (output: dist/)
npm run preview    # Preview production build locally
```

No test or lint scripts are configured. Vitest would pair naturally with Vite if tests are added.

## Architecture

**Stitch** (internal name: Indet Scanner) is a mobile-first PWA for receipt capture and expense management, built with React 18 + TypeScript + Vite. The UI is in Spanish.

### Key directories

- [src/context/AuthContext.tsx](src/context/AuthContext.tsx) — Auth state + `useAuth()` hook; wraps the whole app; includes 8s safety timeout to prevent stuck loading
- [src/lib/supabase.ts](src/lib/supabase.ts) — Supabase client + `writeAuditLog()` helper
- [src/lib/types.ts](src/lib/types.ts) — Shared TypeScript interfaces (`Profile`, `Receipt`, `Category`)
- [src/App.tsx](src/App.tsx) — React Router routes + protected route guards
- [src/pages/](src/pages/) — One file per page; all data fetching is done inline with direct Supabase calls

### Routing

| Route | Page | Access |
|---|---|---|
| `/login` | Login.tsx | Public |
| `/dashboard` | Dashboard.tsx | Auth required |
| `/scanner` | Scanner.tsx | Auth required |
| `/review` | ReviewReceipt.tsx | Auth required |
| `/history` | History.tsx | Auth required |
| `/users` | Users.tsx | Admin only |

### Data layer

No API abstraction layer — pages call Supabase directly. Row-level security is enforced server-side; client-side queries additionally filter by `user_id` for non-admin users.

**Supabase tables:** `profiles`, `receipts`, `categories`, `audit_logs`

Receipt statuses: `pending | synced | flagged`

### Styling

Tailwind CSS 3 with a custom design system in [tailwind.config.js](tailwind.config.js):
- Brand color: `primary: #a63500` (INDET orange)
- Fonts: Manrope (headings), Inter (body)
- Custom utilities: `glass-nav`, `glass-panel`, `editorial-gradient`, `camera-overlay`, `guide-frame`, `receipt-gradient`

Material Symbols icon font is loaded globally via CSS.

### PWA

Configured in [vite.config.ts](vite.config.ts) via `vite-plugin-pwa`. Caching strategies:
- Google Fonts → CacheFirst, 1-year TTL
- Supabase API → NetworkFirst, 5-min TTL
- Workbox precache limit raised to 4 MiB (bundle exceeds 2 MiB default)

`vercel.json` rewrites all routes to `/index.html` for SPA routing.
