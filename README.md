# Aangan — the family courtyard

"Far apart, still together." Most family apps make parents feel cared for; Aangan makes them feel **needed**.

Values, in priority order: **Needed** (elders give and have a role) · **Heard** (acknowledgement) · **Present** (together at the same time) · **Remembered** (memories) · **Never watched** (no monitoring, no guilt).

Aangan is deliberately not Instagram/WhatsApp/Facebook: no stories, status, counts, comments, or infinite feed. **WhatsApp moves messages. Aangan keeps a family going:** what elders know is passed down, things are done together across continents, and aging parents are cared for without being watched.

The app itself is in English. What the family shares (voices, recipes, questions, care notes) reaches each person in their own language: 29 languages, including Hindi, Hinglish, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Spanish, Arabic, Chinese and more (`lib/languages.ts`).

### The rooms

| Room | What it is for |
|---|---|
| Courtyard (home) | Each parent's day as they choose to share it ("Dadi is having chai · 6:40 AM in India"), open doors, the latest voice |
| Kitchen | An elder teaches a recipe **by voice**; Muse writes the card in their own measures ("one katori"); the family cooks it abroad and the cook blesses each attempt |
| Sit together | Not a meeting: a *reason* (cook together, chai, story night), the hours when everyone is awake, a "come sit with me" open door, one-tap video room |
| Care circle | Needs (open → claimed → done), whose week it is to check in, and the parent's **Village**: the trusted local people (grocer, driver, house help, neighbour) who can actually go |
| Memory Lane · Occasions · Family tree | Voices and photos by season, birthdays/festivals with two-way wishes, a tree you can add to, edit and prune |
| What Muse did | Every step the helper took, with model, time and cost |

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

## Built with Meta: Muse, powered backstage

Every model called at runtime is a Meta model. Muse is the family's helper, but it is **never a family member**: it writes down, translates, asks and proposes, and it always brings people back to each other. It never chats with lonely parents in place of their children, never posts as a person, and never gives medical advice.

| Meta model | Where it works in Aangan |
|---|---|
| `muse-voice-transcribe` | Every voice note, wish, blessing, recipe lesson, story answer and spoken request for help (segment timestamps drive synced lyrics) |
| `muse-spark-1.3` · structured output | **Recipe scribe**: a spoken recipe → a card in the cook's own measures, grounding-checked so no ingredient is invented (`lib/kitchen.ts`) |
| | **Story keeper**: one gentle question a week per elder, in their language, never repeated (`lib/keeper.ts`) |
| | **Care**: a spoken need → a task; a reassurance note for the parent in their language (`lib/care.ts`) |
| | **Translation into 29 languages**: voices, recipes (the whole card at once), questions, notes |
| | Memory-card captions incl. video understanding, kinship terms, Gather playlists, the ritual agent's tool-calling loop, search-grounded movable festival dates |
| `muse-image-1.0` | Seed script only: fallback courtyard + demo-family photos in `public/demo/` (labelled AI-generated; never inside real cards) |

How it is kept safe and cheap:

- **One door** (`lib/muse.ts`): Zod-validated structured output, one retry, then a safe fallback. No raw model text reaches the UI.
- **Grounding checks** reject output that isn't supported by what was said (recipes), or that repeats (questions).
- **Cached** by input, so the same recipe or translation is never paid for twice. USD 120 spend cap, refused past the cap.
- **Every call is logged** to the family's *What Muse did* page: purpose, model, latency, cost, cached or not.
- **Agents propose, people approve.** Nothing an agent suggests runs without a person tapping approve.
- Optional Baseten failover (`meta-models/muse-spark-open-1026`) activates only with confirmed credits (`BASETEN_CREDITS_CONFIRMED=1`).

Privacy: presence is only what a parent chooses to share. The "quiet day" note is opt-in and owned by the parent, goes to the one person they chose, and is judged against their own usual rhythm. Nothing is tracked.

## AI-assistance disclosure

This entry was built with AI coding assistants, including Muse Code (agentic CLI) powered by Muse Spark: scaffolding, UI implementation, the LLM client, ritual/agent logic, tests, and docs were drafted with agents and verified by the human via `lint` + `typecheck` + mock tests + production builds. Demo photos and the fallback courtyard are AI-generated and labelled as such in `public/demo/README.md`. All family data is synthetic; no real family data, no real people, no real events. No health advice anywhere in the app.
