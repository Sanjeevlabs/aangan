# BUILD_LOG.md — Aangan (Meta Global AI Developer Hackathon, Indie track)

## 27 Oct 2026 — Day 1: foundation

- Chose Option A: Next.js 14 + TypeScript PWA, Supabase for DB/storage, Vercel deploy.
- Scaffolded app shell (Memory Lane timeline page, PWA manifest) with plain, reduced-motion-safe styling.
- Built one LLM client (`lib/llm.ts`): provider routing via config (Meta default, Baseten only with confirmed credits), all model IDs in config, hash cache, USD 120 spend cap, mock mode.
- Added Zod schemas with one-retry-then-fallback; grounding subset check; upload caps (image ≤5 MB, video ≤30s/≤25 MB + thumbnail); EXIF-first auto-dating.
- Added ritual engine (loads any festival config) + Diwali and birthday configs.
- Added Supabase schema with family-scoped RLS + seeded demo family.
- Added mock-mode unit tests (LLM cache/cap/fallback/routing, rituals), E2E smoke (upload → timeline), golden set (9 synthetic cases) + manual live eval script.
- Added CI (lint, typecheck, mock tests only) and `vercel.json`.
- Demo languages: English + Hindi. Baseten stays optional.
- Design standard locked: tokens in `app/tokens.css`, Tailwind + shadcn-style ui, system stack, light/dark mode, skeleton/empty/error states on every screen, polish time-boxed to 3 Nov.
- Next: `npm install`, Vercel first deploy, Supabase project + schema, then LLM live captioning check.
- Verified 27 Oct: `npm install` green (workspace-local cache; sandbox blocks default npm cache and all listen sockets, so `next dev` cannot bind here — used `next build` instead). `npm run lint` ok. `npm run typecheck` ok. `npm run test:mock`: 13 passed, 1 skipped (live golden eval). `npm run build` ok; `/` prerendered with both seeded demo cards present in static HTML.
- Still yours: `vercel --prod`, create Supabase project + run `supabase/schema.sql`, set `META_API_KEY`, then `npm run eval:golden`.
- Sandbox notes for future sessions: run npm/npx from `D:\Aangan` (never `\\?\`-prefixed cwd, breaks postinstall scripts); set `TEMP`/`TMP` to `D:\Aangan\.tmp` for vitest workers.
