"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Pot } from "@/lib/kinds";
import { openFlowers } from "@/lib/pots";

// Flower pots for the first screen: terracotta and glazed pots with real
// plants, drawn as SVG with gradients and soft shadows (no raster images).
// Light comes from the upper left, like the wall and window. Flowers open with
// the family's bloom (lib/pots.ts); closed ones are green buds, never wilted.
// <PotDefs /> must be on the page once; every pot references its gradients.

type P = { x: number; y: number };

/** Shared gradients and filters (ids prefixed pt-). Render once per page. */
export function PotDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pt-terra" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7c3619" />
          <stop offset=".2" stopColor="#b75e36" />
          <stop offset=".42" stopColor="#c87046" />
          <stop offset=".72" stopColor="#a04b28" />
          <stop offset="1" stopColor="#5f2710" />
        </linearGradient>
        <linearGradient id="pt-terra-rim" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8a3d1d" />
          <stop offset=".25" stopColor="#cf7a50" />
          <stop offset=".5" stopColor="#c46d43" />
          <stop offset="1" stopColor="#6d2e14" />
        </linearGradient>
        <linearGradient id="pt-shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1e0a02" stopOpacity=".45" />
          <stop offset=".18" stopColor="#1e0a02" stopOpacity=".05" />
          <stop offset=".8" stopColor="#1e0a02" stopOpacity="0" />
          <stop offset="1" stopColor="#1e0a02" stopOpacity=".3" />
        </linearGradient>
        {/* glazes */}
        {(
          [
            ["cobalt", "#0b1d3f", "#24508f", "#3b6cb4", "#173a73", "#08142c"],
            ["ivory", "#a99b84", "#e9e0cd", "#f6f0e2", "#d6cab3", "#8e816c"],
            ["celadon", "#23453f", "#4f8a7e", "#6fa597", "#3b6f64", "#1b3530"],
          ] as const
        ).map(([id, ...c]) => (
          <linearGradient key={id} id={`pt-${id}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={c[0]} />
            <stop offset=".22" stopColor={c[1]} />
            <stop offset=".38" stopColor={c[2]} />
            <stop offset=".7" stopColor={c[3]} />
            <stop offset="1" stopColor={c[4]} />
          </linearGradient>
        ))}
        <radialGradient id="pt-soil" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#4a3020" />
          <stop offset="1" stopColor="#1f130b" />
        </radialGradient>
        <radialGradient id="pt-contact" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset=".6" stopColor="#000" stopOpacity=".22" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {/* leaves: lit edge at the top left */}
        <linearGradient id="pt-leaf" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#6f9a45" />
          <stop offset=".5" stopColor="#3f6a26" />
          <stop offset="1" stopColor="#24421a" />
        </linearGradient>
        <linearGradient id="pt-leaf-dark" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#4f7a32" />
          <stop offset=".55" stopColor="#2c5019" />
          <stop offset="1" stopColor="#173010" />
        </linearGradient>
        <linearGradient id="pt-leaf-gloss" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#5f8f3e" />
          <stop offset=".35" stopColor="#2f5a20" />
          <stop offset="1" stopColor="#163212" />
        </linearGradient>
        <linearGradient id="pt-pothos" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#9cc25a" />
          <stop offset=".3" stopColor="#4e8a2e" />
          <stop offset=".45" stopColor="#d8d68a" />
          <stop offset=".55" stopColor="#4a8530" />
          <stop offset="1" stopColor="#24521a" />
        </linearGradient>
        <linearGradient id="pt-pothos-new" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#c8e07a" />
          <stop offset=".5" stopColor="#86b545" />
          <stop offset="1" stopColor="#4c8a2c" />
        </linearGradient>
        <linearGradient id="pt-geran-leaf" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#86ad57" />
          <stop offset=".6" stopColor="#4d7a2e" />
          <stop offset="1" stopColor="#2c4f1a" />
        </linearGradient>
        <linearGradient id="pt-succ" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d58a8a" />
          <stop offset=".22" stopColor="#a9c3b4" />
          <stop offset=".7" stopColor="#7ea596" />
          <stop offset="1" stopColor="#4f7a6c" />
        </linearGradient>
        <linearGradient id="pt-bud" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#9cc062" />
          <stop offset="1" stopColor="#3e6a24" />
        </linearGradient>
        {/* flowers */}
        <radialGradient id="pt-mari" cx="42%" cy="38%" r="65%">
          <stop offset="0" stopColor="#ffd75a" />
          <stop offset=".45" stopColor="#ffa526" />
          <stop offset=".85" stopColor="#e7700c" />
          <stop offset="1" stopColor="#b85206" />
        </radialGradient>
        <radialGradient id="pt-mari-petal" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffc443" />
          <stop offset=".7" stopColor="#f08714" />
          <stop offset="1" stopColor="#c25a08" />
        </radialGradient>
        <radialGradient id="pt-rose" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#e2475a" />
          <stop offset=".6" stopColor="#b3192f" />
          <stop offset="1" stopColor="#6e0a18" />
        </radialGradient>
        <radialGradient id="pt-rose-in" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#8a0f22" />
          <stop offset="1" stopColor="#c62a3e" />
        </radialGradient>
        <radialGradient id="pt-jas" cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".75" stopColor="#f3f1ea" />
          <stop offset="1" stopColor="#d8d4c6" />
        </radialGradient>
        <radialGradient id="pt-geran" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ff6a5c" />
          <stop offset=".7" stopColor="#e0272a" />
          <stop offset="1" stopColor="#a5151b" />
        </radialGradient>
        <radialGradient id="pt-bell" cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffb08a" />
          <stop offset="1" stopColor="#e2603f" />
        </radialGradient>
        <filter id="pt-clay" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.06  0 0 0 0 0.02  1.6 0 0 0 -0.75" result="spk" />
          <feComposite in="spk" in2="SourceGraphic" operator="atop" />
        </filter>
        <filter id="pt-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="pt-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
    </svg>
  );
}

/* ----------------------------------------------------------------- pots */
type Vessel = "terracotta" | "cobalt" | "ivory" | "celadon" | "bowl";
const VESSEL: Record<Pot, Vessel> = { marigold: "terracotta", jasmine: "terracotta", rose: "ivory", geranium: "cobalt", moneyplant: "celadon", succulent: "bowl" };

/** The pot behind the plant: shadow, body, the back of the rim, the soil. */
function PotBack({ v }: { v: Vessel }) {
  if (v === "bowl")
    return (
      <>
        <ellipse cx="50" cy="126" rx="30" ry="3.6" fill="url(#pt-contact)" />
        <path d="M23 104 L77 104 C75.5 116 67 124.5 50 124.5 C33 124.5 24.5 116 23 104 Z" fill="url(#pt-terra)" filter="url(#pt-clay)" />
        <path d="M23 104 L77 104 C75.5 116 67 124.5 50 124.5 C33 124.5 24.5 116 23 104 Z" fill="url(#pt-shade)" />
        <ellipse cx="50" cy="103.5" rx="27.5" ry="3.6" fill="url(#pt-terra-rim)" />
        <ellipse cx="50" cy="103.8" rx="25" ry="2.6" fill="url(#pt-soil)" />
      </>
    );
  if (v === "terracotta")
    return (
      <>
        <ellipse cx="50" cy="126.5" rx="29" ry="3.6" fill="url(#pt-contact)" />
        <path d="M27 87 L73 87 L67.6 124.6 Q50 127.6 32.4 124.6 Z" fill="url(#pt-terra)" filter="url(#pt-clay)" />
        <path d="M27 87 L73 87 L67.6 124.6 Q50 127.6 32.4 124.6 Z" fill="url(#pt-shade)" />
        <ellipse cx="50" cy="79.2" rx="27" ry="3.6" fill="url(#pt-terra-rim)" />
        <ellipse cx="50" cy="79.6" rx="24" ry="2.5" fill="url(#pt-soil)" />
      </>
    );
  return (
    <>
      <ellipse cx="50" cy="126.5" rx="28" ry="3.6" fill="url(#pt-contact)" />
      <path d="M30 86 C21 96 21.5 114 34 124 Q50 128 66 124 C78.5 114 79 96 70 86 Z" fill={`url(#pt-${v})`} />
      <path d="M30 86 C21 96 21.5 114 34 124 Q50 128 66 124 C78.5 114 79 96 70 86 Z" fill="url(#pt-shade)" opacity=".7" />
      {/* the glaze: a soft window highlight and a rim of reflected light */}
      <ellipse cx="37.5" cy="102" rx="2.6" ry="11" fill="#fff" opacity=".5" filter="url(#pt-soft)" />
      <path d="M68 95 C72 103 72 113 66 120" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.6" filter="url(#pt-soft)" />
      <ellipse cx="50" cy="81.8" rx="22.5" ry="3.2" fill={`url(#pt-${v})`} />
      <ellipse cx="50" cy="82.1" rx="20" ry="2.3" fill="url(#pt-soil)" />
    </>
  );
}

/** The front lip of the rim, over the stems. */
function PotLip({ v }: { v: Vessel }) {
  if (v === "bowl")
    return (
      <>
        <path d="M22.5 103.5 Q50 108.6 77.5 103.5 L77 106.2 Q50 111 23 106.2 Z" fill="url(#pt-terra-rim)" />
        <path d="M22.5 103.5 Q50 108.6 77.5 103.5" fill="none" stroke="#f2b48a" strokeOpacity=".55" strokeWidth=".7" />
      </>
    );
  if (v === "terracotta")
    return (
      <>
        <path d="M23 79.2 Q50 84.6 77 79.2 L76.4 87.6 Q50 91.4 23.6 87.6 Z" fill="url(#pt-terra-rim)" filter="url(#pt-clay)" />
        <path d="M23 79.2 Q50 84.6 77 79.2" fill="none" stroke="#f0b088" strokeOpacity=".6" strokeWidth=".8" />
        <path d="M23.6 87.6 Q50 91.4 76.4 87.6" fill="none" stroke="#3a1406" strokeOpacity=".45" strokeWidth="1" />
      </>
    );
  return (
    <>
      <path d="M27.5 81.8 Q50 86.6 72.5 81.8 L71.2 86.8 Q50 90.8 28.8 86.8 Z" fill={`url(#pt-${v})`} />
      <path d="M27.5 81.8 Q50 86.6 72.5 81.8" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth=".8" />
    </>
  );
}

/* --------------------------------------------------------------- plants */
const leaf = (p: P, rx: number, ry: number, a: number, fill = "url(#pt-leaf)", k?: string | number) => (
  <g key={k} transform={`translate(${p.x} ${p.y}) rotate(${a})`}>
    <ellipse cx="0" cy={-ry} rx={rx} ry={ry} fill={fill} />
    <path d={`M0 0 L0 ${-ry * 1.8}`} stroke="#c9e09a" strokeOpacity=".35" strokeWidth=".5" />
  </g>
);

function Marigold({ open }: { open: number }) {
  // Feathery, pinnate leaves on a bushy plant; pom-pom flowers.
  const fronds: [number, number, number, number][] = [
    [50, 80, -62, 18], [48, 80, -30, 22], [52, 80, 26, 22], [50, 80, 58, 18], [46, 78, -82, 15], [54, 78, 84, 15],
    [44, 66, -50, 16], [56, 64, 46, 17], [50, 62, -8, 18], [38, 70, -70, 14], [62, 70, 70, 14], [50, 72, 6, 16],
    [44, 80, -48, 21], [56, 80, 46, 21], [40, 74, -38, 17], [60, 74, 40, 17], [48, 70, -24, 16], [52, 70, 28, 16], [36, 80, -96, 16], [64, 80, 96, 16],
  ];
  const flowers: (P & { r: number })[] = [
    { x: 50, y: 40, r: 11 }, { x: 33, y: 50, r: 9.5 }, { x: 67, y: 47, r: 10 }, { x: 42, y: 61, r: 8.5 }, { x: 60, y: 62, r: 8.5 },
  ];
  return (
    <>
      {flowers.map((f, i) => (
        <path key={`st${i}`} d={`M50 80 Q${(50 + f.x) / 2} ${f.y + 18} ${f.x} ${f.y + 2}`} stroke="#3c6324" strokeWidth="1.3" fill="none" />
      ))}
      {fronds.map(([x, y, a, len], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          <path d={`M0 0 L0 ${-len}`} stroke="#355c20" strokeWidth=".9" />
          {Array.from({ length: 6 }, (_, j) => {
            const t = (j + 1) / 7;
            const s = 1 - t * 0.55;
            return (
              <g key={j}>
                <ellipse cx={-2.4 * s} cy={-len * t} rx={1.1 * s + 0.3} ry={3 * s} transform={`rotate(-38 ${-2.4 * s} ${-len * t})`} fill={i % 3 ? "url(#pt-leaf-dark)" : "url(#pt-leaf)"} />
                <ellipse cx={2.4 * s} cy={-len * t} rx={1.1 * s + 0.3} ry={3 * s} transform={`rotate(38 ${2.4 * s} ${-len * t})`} fill="url(#pt-leaf-dark)" />
              </g>
            );
          })}
          <ellipse cx="0" cy={-len - 1.5} rx="1" ry="2.6" fill="url(#pt-leaf)" />
        </g>
      ))}
      {flowers.map((f, i) =>
        i < open ? (
          <g key={`f${i}`} transform={`translate(${f.x} ${f.y})`}>
            <circle cx="1.2" cy="2" r={f.r} fill="#1a0c00" opacity=".25" filter="url(#pt-soft)" />
            {Array.from({ length: 16 }, (_, j) => {
              const a = (j / 16) * Math.PI * 2;
              return <circle key={j} cx={Math.cos(a) * f.r * 0.72} cy={Math.sin(a) * f.r * 0.62} r={f.r * 0.36} fill="url(#pt-mari-petal)" />;
            })}
            <circle r={f.r * 0.78} fill="url(#pt-mari)" />
            {Array.from({ length: 10 }, (_, j) => {
              const a = (j / 10) * Math.PI * 2 + 0.3;
              return <circle key={j} cx={Math.cos(a) * f.r * 0.42} cy={Math.sin(a) * f.r * 0.36 - 0.8} r={f.r * 0.27} fill="url(#pt-mari-petal)" opacity=".95" />;
            })}
            <circle cx="-.6" cy="-1.4" r={f.r * 0.3} fill="#ffb52e" />
            <path d={`M${-f.r * 0.5} ${-f.r * 0.2} q${f.r * 0.5} ${-f.r * 0.5} ${f.r} 0`} stroke="#fff3c0" strokeOpacity=".5" strokeWidth=".8" fill="none" />
          </g>
        ) : (
          <g key={`f${i}`} transform={`translate(${f.x} ${f.y + 3})`}>
            <ellipse rx="3" ry="4.2" fill="url(#pt-bud)" />
            <path d="M-3 1 L0 -5 L3 1" fill="#4e7a2c" opacity=".7" />
          </g>
        ),
      )}
    </>
  );
}

function Jasmine({ open }: { open: number }) {
  const leaves: [number, number, number][] = [
    [50, 79, -70], [50, 79, 70], [46, 76, -40], [54, 76, 40], [44, 70, -95], [56, 70, 95], [42, 62, -55], [58, 62, 55], [50, 66, -15], [50, 66, 18],
    [38, 54, -75], [62, 54, 78], [46, 52, -30], [54, 50, 30], [34, 64, -110], [66, 64, 110], [50, 44, -5], [42, 42, -45], [58, 42, 48], [30, 52, -100], [70, 52, 100],
  ];
  const flowers: P[] = [
    { x: 50, y: 34 }, { x: 36, y: 44 }, { x: 64, y: 40 }, { x: 28, y: 56 }, { x: 72, y: 55 }, { x: 44, y: 52 }, { x: 58, y: 54 }, { x: 40, y: 32 }, { x: 61, y: 30 },
  ];
  return (
    <>
      <path d="M50 80 C46 66 40 56 36 44 M50 80 C55 64 62 52 64 40 M50 80 C49 60 50 46 50 34 M49 76 C40 70 32 62 28 56 M51 76 C60 70 68 62 72 55" stroke="#3b5e22" strokeWidth="1.1" fill="none" />
      {leaves.map(([x, y, a], i) => leaf({ x, y }, 2.6, 5.4, a, i % 2 ? "url(#pt-leaf-gloss)" : "url(#pt-leaf)", i))}
      {flowers.map((f, i) =>
        i < open ? (
          <g key={`f${i}`} transform={`translate(${f.x} ${f.y}) rotate(${i * 23})`}>
            <circle cx=".8" cy="1.4" r="5.6" fill="#0d1a05" opacity=".2" filter="url(#pt-soft)" />
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-3.3" rx="1.9" ry="3.4" transform={`rotate(${a})`} fill="url(#pt-jas)" stroke="#cfc9b8" strokeWidth=".2" />
            ))}
            <circle r="1" fill="#e9d98a" />
          </g>
        ) : (
          <g key={`f${i}`} transform={`translate(${f.x} ${f.y + 2}) rotate(${(i % 3) * 14 - 14})`}>
            <ellipse cx="0" cy="-2" rx="1.3" ry="3.4" fill="#eef0dc" />
            <path d="M-1.4 0 L0 -1.5 L1.4 0" fill="#5d8a36" />
          </g>
        ),
      )}
    </>
  );
}

function Rose({ open }: { open: number }) {
  const flowers: (P & { r: number })[] = [
    { x: 46, y: 34, r: 9.5 }, { x: 65, y: 44, r: 8.5 }, { x: 33, y: 50, r: 8 },
  ];
  const leafSets: [number, number, number][] = [[42, 64, -60], [58, 60, 55], [50, 72, -20], [36, 70, -95], [64, 72, 95], [54, 50, 40], [40, 46, -40], [60, 34, 70]];
  return (
    <>
      {flowers.map((f, i) => (
        <path key={`st${i}`} d={`M${48 + i * 2} 81 C${48 + i} 66 ${f.x} ${f.y + 22} ${f.x} ${f.y + 4}`} stroke="#3d5a1e" strokeWidth="1.4" fill="none" />
      ))}
      {leafSets.map(([x, y, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          {[-1, 0, 1].map((s) => (
            <g key={s} transform={`translate(${s * 3.4} ${-s * s * 1.5 - 2}) rotate(${s * 32})`}>
              <path d="M0 0 C-3.2 -2 -3.6 -6.2 0 -9 C3.6 -6.2 3.2 -2 0 0 Z" fill={s ? "url(#pt-leaf-dark)" : "url(#pt-leaf)"} />
              <path d="M0 -.5 L0 -8" stroke="#a8c47a" strokeOpacity=".4" strokeWidth=".4" />
            </g>
          ))}
        </g>
      ))}
      {flowers.map((f, i) =>
        i < open ? (
          <g key={`f${i}`} transform={`translate(${f.x} ${f.y})`}>
            <circle cx="1.2" cy="2" r={f.r} fill="#1a0004" opacity=".28" filter="url(#pt-soft)" />
            <path d={`M${-f.r * 0.6} ${f.r * 0.55} L0 ${f.r * 0.95} L${f.r * 0.6} ${f.r * 0.55} Z`} fill="#3d6a22" />
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cx={Math.cos((a * Math.PI) / 180) * f.r * 0.48} cy={Math.sin((a * Math.PI) / 180) * f.r * 0.4} r={f.r * 0.56} fill="url(#pt-rose)" stroke="#5a0612" strokeOpacity=".35" strokeWidth=".4" />
            ))}
            <ellipse cx="0" cy="-.8" rx={f.r * 0.55} ry={f.r * 0.45} fill="url(#pt-rose-in)" />
            <path d={`M${-f.r * 0.32} ${-f.r * 0.1} C${-f.r * 0.25} ${-f.r * 0.55} ${f.r * 0.35} ${-f.r * 0.5} ${f.r * 0.3} ${-f.r * 0.05} C${f.r * 0.22} ${f.r * 0.2} ${-f.r * 0.1} ${f.r * 0.2} ${-f.r * 0.08} ${-f.r * 0.12}`} fill="none" stroke="#56040f" strokeWidth=".7" />
            <path d={`M${-f.r * 0.8} ${-f.r * 0.3} q${f.r * 0.5} ${-f.r * 0.6} ${f.r} ${-f.r * 0.45}`} stroke="#ff9aa6" strokeOpacity=".45" strokeWidth=".7" fill="none" />
          </g>
        ) : (
          <g key={`f${i}`} transform={`translate(${f.x} ${f.y + 3})`}>
            <ellipse cx="0" cy="-1" rx="2.6" ry="4.4" fill="#5d7e2c" />
            <path d="M-3 2 C-3 -2 -1 -5 0 -6 C1 -5 3 -2 3 2 Z" fill="url(#pt-bud)" />
          </g>
        ),
      )}
    </>
  );
}

/** A round, scalloped geranium leaf (a lobe every 36°), seen a little from above. */
const GERAN_LEAF = (() => {
  const pts = Array.from({ length: 61 }, (_, i) => {
    const t = (i / 60) * Math.PI * 2;
    const r = 1 + 0.07 * Math.cos(t * 10);
    return `${(Math.cos(t) * r).toFixed(3)} ${(Math.sin(t) * r * 0.78).toFixed(3)}`;
  });
  return `M${pts.join(" L")} Z`;
})();

function Geranium({ open }: { open: number }) {
  const umbels: P[] = [{ x: 41, y: 33 }, { x: 62, y: 29 }, { x: 53, y: 45 }];
  const leaves: [number, number, number, number][] = [[33, 68, 10, -14], [67, 68, 10, 12], [50, 72, 11, 0], [42, 60, 9.5, -8], [60, 58, 9.5, 10], [26, 76, 8.5, -20], [74, 76, 8.5, 20]];
  return (
    <>
      {umbels.map((u, i) => (
        <path key={`st${i}`} d={`M50 78 C${50 + (u.x - 50) * 0.3} 62 ${u.x} ${u.y + 16} ${u.x} ${u.y + 3}`} stroke="#4b7a2c" strokeWidth="1.2" fill="none" />
      ))}
      {leaves.map(([x, y, r, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a}) scale(${r})`}>
          <path d={GERAN_LEAF} fill="url(#pt-geran-leaf)" stroke="#2c4a18" strokeOpacity=".5" strokeWidth={0.04} />
          {/* the dark zone band and fan of veins that make it a zonal geranium */}
          <ellipse rx=".62" ry=".47" fill="none" stroke="#4a3412" strokeOpacity=".32" strokeWidth=".16" />
          {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((v) => (
            <path key={v} d={`M0 0 L${(Math.cos((v * Math.PI) / 180) * 0.85).toFixed(2)} ${(Math.sin((v * Math.PI) / 180) * 0.66).toFixed(2)}`} stroke="#c8dc9e" strokeOpacity=".35" strokeWidth=".035" />
          ))}
        </g>
      ))}
      {umbels.map((u, i) =>
        i < open ? (
          <g key={`f${i}`} transform={`translate(${u.x} ${u.y})`}>
            <circle cx="1" cy="2" r="9" fill="#1a0000" opacity=".22" filter="url(#pt-soft)" />
            {[[0, -8], [-5.6, -4], [5.6, -4], [-3, -3], [3, -3.2], [0, 0], [-6.2, 2], [6, 2], [-2.8, 4], [2.8, 4]].map(([dx, dy], j) => (
              <g key={j} transform={`translate(${dx} ${dy}) rotate(${j * 17})`}>
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse key={a} cx="0" cy="-1.6" rx="1.45" ry="1.9" transform={`rotate(${a})`} fill="url(#pt-geran)" stroke="#8e1016" strokeOpacity=".25" strokeWidth=".2" />
                ))}
                <circle r=".55" fill="#ffd9cc" />
              </g>
            ))}
          </g>
        ) : (
          <g key={`f${i}`} transform={`translate(${u.x} ${u.y + 2})`}>
            {[[0, 0], [-2.4, -1], [2.4, -1], [-1.2, -3], [1.2, -3]].map(([dx, dy], j) => (
              <ellipse key={j} cx={dx} cy={dy} rx="1.2" ry="1.8" fill="url(#pt-bud)" />
            ))}
          </g>
        ),
      )}
    </>
  );
}

const HEART = "M0 0 C-6 -4 -7.2 -10.5 -3.4 -12.6 C-1.4 -13.6 0 -12 0 -10.6 C0 -12 1.4 -13.6 3.4 -12.6 C7.2 -10.5 6 -4 0 0 Z";

function MoneyPlant({ open }: { open: number }) {
  // Trailing pothos: vines over the rim and down the pot (its natural habit, not drooping).
  const base: [number, number, number, number][] = [
    [50, 78, 0, 1], [43, 76, -38, 0.95], [57, 76, 36, 0.95], [48, 66, -12, 0.9], [55, 66, 22, 0.85],
    [26, 92, -150, 0.85], [22, 106, -165, 0.8], [76, 94, 150, 0.85], [79, 108, 168, 0.75],
  ];
  const fresh: [number, number, number][] = [[50, 56, 5], [40, 64, -30], [62, 62, 34], [20, 118, -172]];
  return (
    <>
      <path d="M44 82 C30 82 26 88 25 96 C24 104 22 112 21 120 M56 82 C70 82 75 88 76 96 C77 104 79 112 79 118 M50 80 C49 72 49 64 50 56" stroke="#4d7a2a" strokeWidth="1.1" fill="none" />
      {base.map(([x, y, a, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
          <path d={HEART} fill="url(#pt-pothos)" />
          <path d="M0 -.5 L0 -10.5" stroke="#e8e6b0" strokeOpacity=".45" strokeWidth=".5" />
        </g>
      ))}
      {fresh.map(([x, y, a], i) =>
        i < open ? (
          <g key={`n${i}`} transform={`translate(${x} ${y}) rotate(${a}) scale(.78)`}>
            <path d={HEART} fill="url(#pt-pothos-new)" />
            <path d="M0 -.5 L0 -10.5" stroke="#f4f7d0" strokeOpacity=".5" strokeWidth=".5" />
          </g>
        ) : (
          <g key={`n${i}`} transform={`translate(${x} ${y}) rotate(${a})`}>
            <path d="M0 0 C-1.2 -3 -1 -6 0 -7.5 C1 -6 1.2 -3 0 0 Z" fill="url(#pt-pothos-new)" />
          </g>
        ),
      )}
    </>
  );
}

function Succulent({ open }: { open: number }) {
  const ring = (n: number, r: number, len: number, w: number, rot: number, key: string) =>
    Array.from({ length: n }, (_, j) => {
      const a = (j / n) * 360 + rot;
      return (
        <g key={`${key}${j}`} transform={`rotate(${a})`}>
          <path d={`M0 0 C${-w} ${-len * 0.3} ${-w * 0.8} ${-len * 0.85} 0 ${-len} C${w * 0.8} ${-len * 0.85} ${w} ${-len * 0.3} 0 0 Z`} transform={`translate(0 ${-r})`} fill="url(#pt-succ)" stroke="#4e6e62" strokeOpacity=".35" strokeWidth=".3" />
        </g>
      );
    });
  const bells: P[] = [{ x: 66, y: 52 }, { x: 70, y: 60 }, { x: 62, y: 46 }];
  return (
    <>
      <path d="M52 98 C56 84 60 66 66 50" stroke="#c0796a" strokeWidth="1.2" fill="none" />
      {bells.map((b, i) =>
        i < open ? (
          <g key={i} transform={`translate(${b.x} ${b.y}) rotate(20)`}>
            <path d="M-2.2 0 C-2.4 3 -1.8 5 0 5.6 C1.8 5 2.4 3 2.2 0 Z" fill="url(#pt-bell)" />
            <path d="M-2 5 L-1 6.6 M0 5.6 L0 7 M2 5 L1 6.6" stroke="#f7d06a" strokeWidth=".5" />
          </g>
        ) : (
          <ellipse key={i} cx={b.x} cy={b.y + 2} rx="1.3" ry="2" fill="#c98a74" />
        ),
      )}
      <g transform="translate(50 100) scale(1 .62)">
        {ring(9, 4, 20, 7.5, 0, "a")}
        {ring(8, 2, 15, 6.5, 22, "b")}
        {ring(6, 0.5, 10, 5, 8, "c")}
        <circle r="2.6" fill="#a9c9b6" />
      </g>
    </>
  );
}

const PLANT: Record<Pot, (p: { open: number }) => ReactNode> = { marigold: Marigold, jasmine: Jasmine, rose: Rose, geranium: Geranium, moneyplant: MoneyPlant, succulent: Succulent };

/** One pot with its plant. `height` in px; the width follows (100:130). */
export function PotArt({ kind, bloom, height, sway = true, delay = 0, className, style }: { kind: Pot; bloom: number; height: number; sway?: boolean; delay?: number; className?: string; style?: CSSProperties }) {
  const v = VESSEL[kind];
  const Plant = PLANT[kind];
  const open = openFlowers(kind, bloom);
  return (
    <svg viewBox="0 0 100 130" width={(height * 100) / 130} height={height} className={className} style={{ overflow: "visible", filter: "drop-shadow(1.5px 3px 2.5px rgba(10,4,0,.35))", ...style }} aria-hidden="true">
      <PotBack v={v} />
      <g className={sway ? "pot-sway" : undefined} style={{ transformOrigin: "50px 82px", animationDelay: `${-delay}s` }}>
        <Plant open={open} />
      </g>
      <PotLip v={v} />
    </svg>
  );
}
