# public/demo — AI-generated seed assets

`courtyard.jpg` is AI-generated (Meta Muse Image, model `muse-image-1.0`,
generated once on 27 Oct 2026 via `scripts/gen-courtyard.mjs`). It is a
synthetic fallback illustration — a traditional courtyard with an arched
wooden doorway, potted plants, morning light; no people, no real place — used
only when a member has no home photo. It never appears inside real memory
cards. The in-app SVG courtyard (`components/courtyard-art.tsx`) remains as an
offline fallback if this image fails to load.
