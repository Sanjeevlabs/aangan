# Aangan design system and product map

Source of truth for every screen, control and visual rule. If code and this
file disagree, fix one of them in the same commit.

## 1. The one idea

Aangan is a family's courtyard: a place where you **hear** the people you love
and **answer** them. Every screen serves one loop:

> hear someone → feel something → answer them (voice, a blessing, a photo).

Voices are treated like music: people are the artists, their voice notes are
the tracks, a photo is the album art. That metaphor gives the app its look,
its controls (play, scrub, lyrics) and its tone (warm, intimate, never a feed).

## 2. Principles, with the reasoning

| Principle | Why | What it rules out |
|---|---|---|
| **One dominant action per screen** | The core loop is "answer someone". If five things compete, elders and busy children do none | Tab bars with 4–5 equal tabs; toolbars of icons |
| **People, not media types** | Families think "Maa sent something", never "a new audio card" | Section names like "Voices", "Photos", "Media"; type filters as primary navigation |
| **The photo is the surface** | Real faces carry the emotion; chrome should step back | Gradient placeholders, coloured card backgrounds, decorative illustration |
| **Glass only over imagery** | Glass on white is invisible and looks like a bug; over a photo it lets the photo stay present while keeping text legible | Glass panels on the white page; stacked glass on glass |
| **Serif means a real voice** | Literata italic is used only for words a person actually said (quotes, transcripts, lyrics). Readers learn the rule without being told | Serif headings, serif buttons |
| **Never a dashboard, never a feed** | Metrics and infinite scroll create obligation and guilt; Aangan creates presence | Counts, streaks, "last active", unread badges, infinite lists |
| **Settings live in Settings** | Language, timezone and notifications are set once; they must not tax every visit | Language pickers on Home or Welcome |
| **Kinship from the viewer** | The same woman is Dadi to Leo, Maa to Arjun, Grandma to a cousin in Toronto. Labels always use the viewer's relation | Hard-coded "Dadi", "Talk to Dadi" |

## 3. Visual tokens

- **Ground:** `#FFFFFF`. Text: `rgba(0,0,0,.88)` primary, `.56` secondary, `.38` tertiary. Hairline `rgba(0,0,0,.08)`.
- **Signal:** marigold `#F5A524`, used only for live states: heard, playing now, recording. Never decorative.
- **Per-card colour:** each photo card derives its tint and its shadow (`0 24px 50px -18px <dominant colour>`) from the photo, so the page gets colour from the family, not from the brand.
- **Glass:** `rgba(255,255,255,.16)`, `backdrop-filter: blur(22px) saturate(1.7)`, `1px rgba(255,255,255,.32)` border, `inset 0 1px 0 rgba(255,255,255,.45)` highlight. Dock variant on white: `rgba(255,255,255,.62)`, hairline border, `0 12px 40px rgba(0,0,0,.14)`. Max two glass layers on screen at once (performance and legibility).
- **Type:** Onest (UI: 28/22/17/15/13, weights 400/500/600/700), Literata italic (spoken words only: 26/21/17). Tabular numerals for durations.
- **Radii by hierarchy:** hero 30, cards 22–26, covers 20, controls are full circles or capsules. Not one radius for everything.
- **Motion:** respond to the person, never ambient. Sheet/route transitions 220–320 ms spring; play button morph; one celebration moment each for a new bond and a Birthday Reel. All of it off under `prefers-reduced-motion`.

## 4. Navigation (why there is no tab bar)

A floating glass **dock** at the bottom of Home:

```
[ ● Talk to <person> ]  [ camera ]  [ ⋯ ]
```

- **Talk to `<person>`.** The primary action, voice-first. `<person>` is the viewer-relative kinship name of whoever you last heard from (Maa, Papa, Dadi, Nani, Aria). Tap opens the recorder with that person pre-selected and others one tap away. A brand-new family with nobody else yet sees **Invite family** instead.
- **Camera.** Share a photo or a short video from today.
- **⋯ Rooms.** A glass sheet with the four other places: Memory Lane, Occasions, Gather, Family tree, plus Settings.

**Why not tabs.** Tabs give five destinations equal weight and turn the app into a utility. Aangan has one loop, so it gets one big button.

**What it costs.** Rooms are one extra tap away. Mitigation: each room surfaces on Home as content with a door into it (the next occasion, the next gathering, a memory from years ago).

Inside a room: a large title, a back chevron, no dock. Rooms are places you visit, then return to the courtyard from.

## 5. Screen map

| Screen | Job | Primary action | Notes |
|---|---|---|---|
| **Landing** (signed out) | Say what Aangan is in one breath | Get started | Full-bleed home photo, one line ("Hear the people you love, every day"), Sign in as a text link |
| **Sign in** | Get back in without passwords | Send code | Email, then a 6-digit code. "Explore a demo family" link for judges |
| **Create family** | Start a courtyard | Create | Family name, your first name, your relation (e.g. son) |
| **Join family** | Join with a code from a relative | Join | Invite code, then "Who are you?": pick yourself or add yourself |
| **Home photo** (onboarding) | Make it yours | Use this photo | "The home you miss: a courtyard, a window, a doorway". Skippable |
| **Home** (the courtyard) | Feel someone today | Play the hero | Hero now-playing card (latest voice from family), heard line, **Your family** row (one album per person), next occasion, next gathering, one memory from years ago |
| **Person** (album) | Everything from one person | Talk to them | Big portrait, their voices as a track list, their photos, relation line ("Your grandmother · Pune") |
| **Now playing** | Hear one voice fully | Reply | Full-screen, blurred art backdrop, waveform scrubber, lyrics transcript, reactions (Love, Laugh, Bless) + Reply |
| **Recorder** (Talk to) | Answer by voice | Record / Send | Recipient chips, large record button, live waveform, review then send. Consent prompt the first time |
| **Photo composer** | Share a moment | Share | Pick or shoot, optional note, recipients default to everyone |
| **Memory Lane** | Walk back through time | Open a memory | Chapters by season, one column of photo cards with glass captions |
| **Occasions** | What is coming, and your part in it | Add your wish | Next occasion as a large photo card, then a quiet list; Birthday Reel when the day arrives |
| **Birthday Reel** | The family's gift, played in order | Play | Full-screen, segmented progress, petals once |
| **Gather** | Plan an evening together | Plan evening | Date and time shown in every member's local time, playlist the agent prepared, Start together |
| **Family tree** | See and grow the family | Add someone | Generational tree with portraits, guided add |
| **Settings** | Set once, forget | — | Profile, language and script (English default), time zone, home photo, notifications, invite family, privacy and data, sign out |

## 6. States every screen must have

Loading (skeletons shaped like the content), empty (one line that invites the next action: "Nobody has spoken yet. Say hello first."), error (what happened and what to do), offline (the last cached state plus "You're offline").

## 7. Performance bar (A-grade)

- `next/image` everywhere, responsive `sizes`, AVIF/WebP, `priority` on the hero only, blur placeholders. No layout shift (CLS 0).
- Fonts via `next/font`, two families, subset, `display: swap`.
- framer-motion through `LazyMotion` + `domAnimation`, so the motion bundle stays small.
- Waveforms are plain DOM bars (≤64), precomputed peaks; live analyser only while recording or playing.
- At most two `backdrop-filter` layers visible; solid fallback when unsupported.
- Targets: Lighthouse mobile performance ≥ 90, accessibility ≥ 95, interaction under 100 ms.

## 8. Language

English by default for everyone. Settings → Language offers English, Hinglish (Hindi in English letters) and हिंदी. Content in another language shows "Translated for you" with a tap to see the original.
