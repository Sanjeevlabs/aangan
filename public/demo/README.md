# public/demo — AI-generated seed assets

All files here are synthetic (Meta Muse Image, model `muse-image-1.0`). They
show a consistent fictional demo family — Dadi (elderly woman, silver bun,
maroon shawl), Arjun (man in his 30s), Leo (8-year-old boy), Aria (6-year-old
girl) — generated from one shared character block per prompt (see
`scripts/seed.mjs`). They are labelled demo photos in the app and never appear
inside real memory cards, which must only show the family's own uploads.

- `courtyard.jpg` (27 Oct 2026, `scripts/gen-courtyard.mjs`): fallback home
  illustration — arched wooden doorway, potted plants, morning light; no
  people. Used only when a member has no home photo. The in-app SVG courtyard
  (`components/courtyard-art.tsx`) remains the offline fallback.
- `family-dadi.webp`, `family-leo.webp`, `family-aria.webp`,
  `family-group.webp` (28 Oct 2026, `node scripts/seed.mjs`): consistent
  demo-family portraits. Manifest: `family.json`.
