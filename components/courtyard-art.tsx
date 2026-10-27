// Illustrated courtyard fallback: abstract arches, sun, and plants — no people,
// no real place. Replaced per-member by an uploaded home photo, and globally
// by the Muse Image courtyard in M7.
export function CourtyardArt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Illustrated courtyard"
    >
      <defs>
        <linearGradient id="court-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe3c2" />
          <stop offset="55%" stopColor="#ffc9a0" />
          <stop offset="100%" stopColor="#f2a56f" />
        </linearGradient>
        <linearGradient id="court-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7cfa4" />
          <stop offset="100%" stopColor="#e09a63" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#court-sky)" />
      <circle cx="200" cy="150" r="44" fill="#fff3df" opacity="0.9" />
      <rect x="30" y="180" width="340" height="320" rx="8" fill="url(#court-wall)" />
      <path d="M150 500 v-140 a50 50 0 0 1 100 0 v140 z" fill="#7c4a2d" />
      <path d="M165 500 v-135 a35 35 0 0 1 70 0 v135 z" fill="#a86436" />
      <rect x="60" y="230" width="54" height="70" rx="26" fill="#7c4a2d" opacity="0.85" />
      <rect x="286" y="230" width="54" height="70" rx="26" fill="#7c4a2d" opacity="0.85" />
      <rect x="30" y="180" width="340" height="18" fill="#8a4f30" opacity="0.55" />
      {[70, 120, 170, 220, 270, 320].map((x) => (
        <rect key={x} x={x} y={150} width={10} height={34} rx={4} fill="#8a4f30" opacity="0.55" />
      ))}
      <ellipse cx="60" cy="470" rx="46" ry="16" fill="#6f7f52" opacity="0.8" />
      <ellipse cx="340" cy="470" rx="46" ry="16" fill="#6f7f52" opacity="0.8" />
      <ellipse cx="90" cy="446" rx="26" ry="22" fill="#7f9159" opacity="0.9" />
      <ellipse cx="312" cy="446" rx="26" ry="22" fill="#7f9159" opacity="0.9" />
      <rect x="0" y="478" width="400" height="22" fill="#9a6238" opacity="0.5" />
    </svg>
  );
}
