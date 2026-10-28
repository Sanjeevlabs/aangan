# Aangan — the family courtyard

"Far apart, still together." Most family apps make parents feel cared for; Aangan makes them feel **needed**.

Values, in priority order: **Needed** (elders give and have a role) · **Heard** (acknowledgement) · **Present** (together at the same time) · **Remembered** (memories) · **Never watched** (no monitoring, no guilt).

Aangan is deliberately not Instagram/WhatsApp/Facebook: no stories, status, counts, comments, or infinite feed. Display languages: English · Hinglish (Hindi in English letters) · हिंदी.

## Built during the hackathon

Solo Indie-track entry, Meta Global AI Developer Hackathon. Deadline 4 Nov 2026, 9:00 PM ET.

Everything in this repo was built during the event window (27 Oct – 4 Nov 2026); see [BUILD_LOG.md](BUILD_LOG.md) for the day-by-day record. Stack: Next.js 14 PWA on Vercel, Supabase (Postgres + private Storage + RLS by `family_id`), one Next.js app, no queues or workers. One seeded demo family (`demo-family`); no full auth flow for V1.

Run it:

- `npm install`, then `npm run dev` — local dev server (mock mode unless `.env.local` sets keys + `MOCK=false`).
- `npm run lint` — secret scan + no hard-coded festivals in app logic.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run test:mock` — mock-mode unit + smoke tests (no network, no cost).
- `npm run eval:golden` — manual live golden eval. Needs `META_API_KEY`. Never in CI.
- `node scripts/seed.mjs` — generates the consistent demo-family photos (needs `META_API_KEY`).

Environment (see `.env.example`; never commit `.env.local`):

- `META_API_KEY` — Meta model calls. Environment only, never written to any file.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project.
- `SUPABASE_SECRET_KEY` — server-only service-role key for route handlers.
- `MOCK` — `true` keeps the in-memory mock store (tests always run mock); set `false` for live Supabase dev.

## Meta AI tooling used

| Model | Used for |
|---|---|
| `muse-spark-1.3` (structured output) | Memory-card captions incl. video understanding, voice-transcript fallback, translations/transliterations, elder question suggestions, Gather playlists, agent tool-calling loop |
| `muse-voice-transcribe` | Voice notes, wishes, blessings (segment timestamps drive synced lyrics) |
| `muse-image-1.0` | Seed script only: fallback courtyard + consistent demo-family photos in `public/demo/` (AI-generated notice shipped alongside; never inside real cards) |

All model responses are Zod-validated (one retry, then a safe fallback card). No raw model text reaches the UI. Client-side hash cache per model + input; USD 120 spend cap enforced in `lib/llm.ts` (refuses past the cap). Optional Baseten failover (`meta-models/muse-spark-open-1026`) activates only with confirmed credits (`BASETEN_CREDITS_CONFIRMED=1`).

## AI-assistance disclosure

This entry was built with Muse Code (agentic CLI) powered by Muse Spark: scaffolding, UI implementation, the LLM client, ritual/agent logic, tests, and docs were drafted by the agent and verified by the human via `lint` + `typecheck` + mock tests + production builds. Demo photos and the fallback courtyard are AI-generated and labelled as such in `public/demo/README.md`. All family data is synthetic; no real family data, no real people, no real events. No health advice anywhere in the app.
