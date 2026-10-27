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

## 28 Oct 2026 — M1: design system, Welcome, Home shell, Add sheet, media pipeline

- Saved the approved PRD verbatim as `docs/PRD.md` (single source of truth); `AGENTS.md` now points at it. Approved adjustments applied: Birthday Reel M4→M5, M4 uses a labelled cached movable-date fixture (live grounding→M6), seed script written M6/run M7, no P1 before the M5 checkpoint. Demo languages: English + Hindi only.
- Discarded the old UI. New: tokens in `app/tokens.css` (warm light-first palette + dark, glass spec, espresso/outline pills, serif display); adaptive 3-glow wash (`components/wash.tsx`, still under reduced motion); glass primitives (`components/ui/glass.tsx`); glass tab bar Home·Lane·Add·Rituals·Gather with raised centre Add (`components/tab-bar.tsx`).
- Welcome screen (`components/welcome.tsx`): full-bleed home image (per-member → family default → illustrated `CourtyardArt` fallback), bottom glass card with greeting, serif "Welcome to <first>'s Aangan", warm signal line (MOCK until M2/M4), Change home + Step inside. Shown once per session; home colors seed the wash.
- Home shell (`components/home.tsx`): elder "Today's role" (MOCK until M4) vs "From Dadi", Voices, Today (API-backed session uploads), This day years ago, Coming up (computed from member birthdays), Record-for-them one tap away, viewer switcher (Dadi/Arjun/Leo/Aria). Lane/Rituals/Gather tabs render honest Soon placeholders.
- Client media pipeline: validate → exifr EXIF date + Make/Model → canvas re-encode (strips all EXIF incl. GPS) → dominant palette → waveform peaks → session store → POST /api/cards (Zod-validated). Glasses badge when Make/Model names Meta/Ray-Ban/Oakley or the manual toggle is on. Video ≤30s/≤25MB with client thumbnail.
- Mock-first storage: `lib/media-session.ts` is the single swap seam (session blobs + metadata-only server store); object URLs do not survive reload — disappears with Supabase. New routes: `/api/cards` GET/POST, `/api/members` GET, `/api/members/home-image` POST.
- Added deps: framer-motion (sheet/tab motion), exifr (EXIF read). i18n dictionary (en+hi) for M1 chrome; Ask tab uses static starters until M2; Voice tab is an M2 placeholder.
- Verified 28 Oct: `npm run lint` ok, `npm run typecheck` ok, `npm run test:mock` 28 passed + 1 skipped (live golden eval), `npm run build` ok. Live-model cost this milestone: USD 0 (no live calls; mock only).
- Still yours: create the Supabase project + run schema (mock-first until you confirm), `vercel --prod`, set `META_API_KEY`.

## 28 Oct 2026 — M1 visual-review fixes (4 items)

- Welcome no longer renders the tab bar (new `chromeHidden` shell flag, set while Welcome is up); its card uses `max(2rem, env(safe-area-inset-bottom))` so both buttons stay visible.
- Desktop phone column: shell content is now `max-w-[480px]` centred; Welcome renders inside the same 480px column over the adaptive wash (nothing full-bleed beyond it); Add sheet capped at 440px. Note: this narrows the PRD's "full-bleed image" to full-bleed *within the column*.
- Fallback courtyard is now photorealistic via Muse Image (`scripts/gen-courtyard.mjs`, precursor of the M6 seed script): `public/demo/courtyard.jpg`, 960×960 JPEG, 133,563 bytes (≤300 KB), verified on inspection — arched wooden doorway, potted plants, morning light, no people/text/numbers — plus the AI-generated notice in `public/demo/README.md`. SVG courtyard kept as the offline onError fallback. Key read from the environment only; never printed or written.
- Foundation correction: `lib/config.ts` image model was `muse-image-style` (404s); the documented Model API id is `muse-image-1.0` (verified against Meta docs via two sources: OpenAI-compatible `POST /v1/images/generations`, flat $0.01/image).
- Cost: provider returned usage `{input_tokens: 10471, output_tokens: 1282}` with no cost field; billed at the documented flat rate → **USD 0.01** for 1 image. Spend-cap ledger wiring for image calls lands with the M6 seed script.
- New maintained test `tests/demo-assets.test.ts` (asset exists, JPEG, ≤300 KB, notice present). Fixes #1/#2 are visual and not coverable by the node-only vitest harness — verified via build; needs your eyes in the browser.
- Verified: `npm run lint` ok, `npm run typecheck` ok, `npm run test:mock` 30 passed + 1 skipped, `npm run build` ok. `package.json` untouched by the one-off sharp conversion (installed `--no-save`, uninstalled after).
- Unstyled-tab-bar report (browser screenshot): investigated — production CSS provably contains all app styles (`.glass`, `wash-glow`, `backdrop-filter`, `bg-espresso`, `--wash-1`, `.shelf`), layout imports `globals.css`, no `pages/` shadow. No repo defect found; cause is almost certainly a stale `next dev` process or cached CSS in the tab (dev server cannot be reproduced in this sandbox — listen sockets blocked). Asked for dev restart + hard refresh + fresh screenshot.
