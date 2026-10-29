"use client";

import type { Place } from "@/lib/kinds";
import { cn } from "@/lib/utils";

// An illustrated neighbourhood: home in the middle, the places that matter
// around it, lanes between. Ours, flat and people-free; no map imagery copied.

export const PLACE_LOOK: Record<Place["kind"], { label: string; color: string }> = {
  home: { label: "Home", color: "#c96f4a" },
  temple: { label: "Temple", color: "#e0912f" },
  market: { label: "Market", color: "#5f9a4a" },
  school: { label: "School", color: "#5b7fb5" },
  park: { label: "Park", color: "#4f8f5a" },
  "tea-stall": { label: "Tea stall", color: "#a0663a" },
  hospital: { label: "Clinic", color: "#c0504d" },
  station: { label: "Station", color: "#6b6b8a" },
  friend: { label: "Friend's home", color: "#b06b9a" },
  other: { label: "Place", color: "#7a7a7a" },
};

function Glyph({ kind }: { kind: Place["kind"] }) {
  const p = { fill: "none", stroke: "#fff", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "home":
      return <path d="M-7 1l7-6 7 6v6h-14z" {...p} />;
    case "temple":
      return <path d="M-6 7v-6h12v6M-4 1l4-8 4 8M0 -7v-2" {...p} />;
    case "market":
      return <path d="M-7 -2h14l-2 9h-10zM-4 -2l1-5h6l1 5" {...p} />;
    case "school":
      return <path d="M-7 -1l7-4 7 4-7 4zM-4 1v4c2 2 6 2 8 0V1" {...p} />;
    case "park":
      return <path d="M0 8V0M0 0c-6 0-6-8 0-8s6 8 0 8z" {...p} />;
    case "tea-stall":
      return <path d="M-6 -2h10v4a5 5 0 0 1-10 0zM4 -1h2a2 2 0 0 1 0 4h-2M-3 -6c0-1 1-1 1-2" {...p} />;
    case "hospital":
      return <path d="M0 -6v12M-6 0h12" {...p} />;
    case "station":
      return <path d="M-5 -6h10v9h-10zM-5 0h10M-3 6l-1 2M3 6l1 2" {...p} />;
    default:
      return <circle r="3" fill="#fff" />;
  }
}

export function Neighbourhood({ places, selected, onSelect }: { places: Place[]; selected: string | null; onSelect: (id: string) => void }) {
  const home = places.find((p) => p.kind === "home");
  const around = places.filter((p) => p !== home);
  const W = 360;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2 + 6;
  // A few places fan out above home; more go all the way round.
  const FEW: Record<number, number[]> = { 1: [-90], 2: [-140, -40], 3: [-155, -90, -25], 4: [-150, -105, -75, -30] };
  const pos = (i: number, n: number) => {
    const deg = FEW[n]?.[i] ?? -90 + (i * 360) / n;
    const a = (deg * Math.PI) / 180;
    return { x: cx + Math.cos(a) * 118, y: cy + Math.sin(a) * (n <= 4 ? 104 : 96) };
  };
  // Keep labels inside the picture.
  const anchor = (x: number) => (x < 70 ? "start" : x > W - 70 ? "end" : "middle");
  const dx = (x: number) => (x < 70 ? -16 : x > W - 70 ? 16 : 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label="Places around home">
      <defs>
        <radialGradient id="nb-ground" cx="0.5" cy="0.52" r="0.6">
          <stop offset="0" stopColor="#fbf1de" />
          <stop offset="1" stopColor="#f1e4c9" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} rx="28" fill="url(#nb-ground)" />
      {/* a few trees and a river so it reads as a place, not a chart */}
      <path d="M0 250 C 80 230, 140 280, 230 262 S 330 240, 360 252 V300 H0z" fill="#d6e6e3" />
      {[[34, 46], [318, 58], [52, 196], [300, 196], [178, 34]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} aria-hidden="true">
          <circle r="11" fill="#b9d3a4" />
          <circle cx="7" cy="4" r="8" fill="#a9c792" />
        </g>
      ))}
      {around.map((p, i) => {
        const { x, y } = pos(i, around.length);
        return <path key={`lane-${p.id}`} d={`M${cx} ${cy} Q ${(cx + x) / 2 + (y - cy) * 0.12} ${(cy + y) / 2 - (x - cx) * 0.12} ${x} ${y}`} stroke="#e2cfa8" strokeWidth="9" fill="none" strokeLinecap="round" />;
      })}
      {/* home */}
      <g transform={`translate(${cx} ${cy})`} onClick={() => home && onSelect(home.id)} className={cn(home && "cursor-pointer")} role={home ? "button" : undefined} aria-label={home ? home.name : "Home"}>
        <rect x="-26" y="-20" width="52" height="40" rx="10" fill={PLACE_LOOK.home.color} stroke={selected === home?.id ? "#111" : "#fff"} strokeWidth="3" />
        <g transform="scale(1.4)">
          <Glyph kind="home" />
        </g>
        <text y="36" textAnchor="middle" className="fill-[#3a2a1c] text-[12px] font-semibold">
          {home?.name ?? "Home"}
        </text>
      </g>
      {around.map((p, i) => {
        const { x, y } = pos(i, around.length);
        const look = PLACE_LOOK[p.kind];
        const on = selected === p.id;
        return (
          <g key={p.id} transform={`translate(${x} ${y})`} onClick={() => onSelect(p.id)} className="cursor-pointer" role="button" aria-label={p.name} aria-pressed={on}>
            <circle r={on ? 19 : 16} fill={look.color} stroke={on ? "#111" : "#fff"} strokeWidth="3" />
            <Glyph kind={p.kind} />
            {p.cardIds.length > 0 && (
              <g transform="translate(12 -12)">
                <circle r="8" fill="#111" />
                <text y="3.5" textAnchor="middle" className="fill-white text-[9px] font-bold">
                  {p.cardIds.length}
                </text>
              </g>
            )}
            <text y="32" x={dx(x)} textAnchor={anchor(x)} className="fill-[#3a2a1c] text-[11.5px] font-semibold">
              {p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** "https://maps.google.com/...@26.45,80.33,17z" or "?q=26.45,80.33" → coordinates. */
export function coordsFromLink(text: string): { lat: number; lng: number } | null {
  const m = text.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ?? text.match(/[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) ?? text.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
