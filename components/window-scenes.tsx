"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The first screen's other two places to stand (the window is in window.tsx):
// a balcony, looking out over a painted wrought-iron railing, and inside an
// open courtyard, between two lime-washed walls on an old terracotta floor.
// Built as a real one-point-perspective room in CSS 3D (perspective + rotated
// planes), so the floor tiles, walls, niche and door all foreshorten
// correctly. Textures are the small procedural SVGs in public/window/. Light
// comes from the upper left, as on the window.

/** The measured size of an element (0 × 0 until it is on screen). */
export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setBox({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

/** A pinhole camera: eye at the middle, a little below the top half. */
export interface Cam {
  w: number;
  h: number;
  /** Perspective distance, px. */
  p: number;
  /** Eye height on screen (the horizon), px. */
  oy: number;
}
export const camFor = (w: number, h: number): Cam => ({ w, h, p: Math.round(w * 1.6), oy: Math.round(h * 0.42) });

/** Where a point in the room lands on screen (z < 0 is into the screen), and how much it shrinks. */
export function project(c: Cam, x: number, y: number, z: number): { x: number; y: number; k: number } {
  const k = c.p / (c.p - z);
  return { x: c.w / 2 + (x - c.w / 2) * k, y: c.oy + (y - c.oy) * k, k };
}

/* -------------------------------------------------------------- courtyard */
// A real-sized aangan: about three camera-heights wide, walls a storey high
// (they rise past the top of the screen near you), a low wall at the far end
// with their view beyond it. You stand a step in from the near edge.
const YARD_SIDE = 0.75; // each wall's distance from the centre line, in screen widths
const YARD_K_FAR = 0.44; // how much the far end shrinks
/** Depth from you to the far low wall, px. */
export const yardDepth = (c: Cam) => Math.round(c.p * (1 / YARD_K_FAR - 1));
/** The two side walls' x in the room. */
export const yardWalls = (c: Cam) => ({ l: Math.round(c.w / 2 - YARD_SIDE * c.w), r: Math.round(c.w / 2 + YARD_SIDE * c.w) });
/** The low wall at the far end: its height in the room, px. */
export const yardFarWall = (c: Cam) => Math.round((c.h - c.oy) * 0.4);
/** The stone step the lamp stands on (a box in the room). */
export const yardStep = (c: Cam) => ({ x0: Math.round(c.w * 0.07), x1: Math.round(c.w * 0.33), z0: -92, d: 74, hgt: 32 });

export function CourtyardRoom({ cam, night }: { cam: Cam; night: boolean }) {
  const { w, h, p, oy } = cam;
  const zf = yardDepth(cam);
  const { l, r } = yardWalls(cam);
  const width = r - l;
  const top = Math.round(-0.1 * h);
  const wallH = h - top;
  const fw = yardFarWall(cam);
  const st = yardStep(cam);
  const sw = st.x1 - st.x0;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ perspective: `${p}px`, perspectiveOrigin: `50% ${oy}px` }} aria-hidden="true">
      {/* The low wall at the far end, its coping catching the light */}
      <div className="wall-paint absolute" style={{ left: l, width, top: h - fw, height: fw, transform: `translateZ(${-zf}px)` }}>
        <div className="wall-plaster absolute inset-0" />
        <div className="yard-plinth absolute inset-x-0 bottom-0" style={{ height: fw * 0.22 }} />
        <div className="absolute inset-0" style={{ background: night ? "rgba(10,6,2,.3)" : "linear-gradient(180deg, rgba(255,246,228,.06), rgba(20,10,4,.3))" }} />
      </div>
      <div className="yard-cap absolute" style={{ left: l, width, top: h - fw - 22, height: 22, transformOrigin: "50% 100%", transform: `translateZ(${-zf}px) rotateX(90deg)` }} />
      {/* The floor: old terracotta tiles in lime mortar */}
      <div className="yard-floor absolute" style={{ left: l, width, top: h - zf, height: zf, transformOrigin: "50% 100%", transform: "rotateX(90deg)" }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(25,10,2,.5), rgba(25,10,2,0) 6%), linear-gradient(90deg, rgba(25,10,2,.35), rgba(25,10,2,0) 4%, rgba(25,10,2,0) 96%, rgba(25,10,2,.35))" }} />
        {!night && (
          <>
            {/* the left wall's shadow across the floor, and the sun on the open part */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(30,12,4,.52) 0, rgba(30,12,4,.48) 26%, rgba(30,12,4,0) 31%)" }} />
            <div className="absolute inset-0" style={{ background: "radial-gradient(40% 30% at 62% 60%, rgba(255,228,184,.22), rgba(255,228,184,0) 70%)" }} />
          </>
        )}
      </div>
      {/* Left wall, in shade; an arched niche with a little ledge */}
      <div className="wall-paint yard-wall absolute" style={{ left: l, top, width: zf, height: wallH, transformOrigin: "0 50%", transform: "rotateY(90deg)" }}>
        <div className="wall-plaster absolute inset-0" />
        <div className="yard-niche absolute" style={{ left: zf * 0.6, width: zf * 0.1, bottom: wallH * 0.36, height: wallH * 0.24 }} />
        <div className="yard-ledge absolute" style={{ left: zf * 0.59, width: zf * 0.12, bottom: wallH * 0.36 - 5, height: 6 }} />
        <div className="yard-plinth absolute inset-x-0 bottom-0" style={{ height: wallH * 0.1 }} />
        <div className="absolute inset-0" style={{ background: night ? "rgba(10,6,2,.25)" : "linear-gradient(90deg, rgba(20,10,4,.3), rgba(20,10,4,.42))" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(20,10,4,.42), rgba(20,10,4,0) 12%), linear-gradient(270deg, rgba(20,10,4,.3), rgba(20,10,4,0) 4%)" }} />
      </div>
      {/* Right wall, in the sun; an old teak door */}
      <div className="wall-paint yard-wall absolute" style={{ left: r - zf, top, width: zf, height: wallH, transformOrigin: "100% 50%", transform: "rotateY(-90deg)" }}>
        <div className="wall-plaster absolute inset-0" />
        <div className="yard-door absolute" style={{ left: zf * 0.14, width: zf * 0.13, bottom: 0, height: wallH * 0.62 }}>
          <div className="win-wood yard-door-leaf absolute" style={{ inset: "8px 8px 0 8px" }}>
            <span className="yard-door-split" />
            <span className="yard-ring" style={{ left: "calc(50% - 10px)" }} />
            <span className="yard-ring" style={{ left: "calc(50% + 4px)" }} />
          </div>
        </div>
        <div className="yard-plinth absolute bottom-0 left-0" style={{ height: wallH * 0.1, width: zf * 0.14 }} />
        <div className="yard-plinth absolute bottom-0 right-0" style={{ height: wallH * 0.1, left: zf * 0.27 }} />
        <div className="absolute inset-0" style={{ background: night ? "rgba(10,6,2,.25)" : "linear-gradient(270deg, rgba(255,238,205,.16), rgba(255,238,205,.04) 70%, rgba(20,10,4,.14))" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(20,10,4,.36), rgba(20,10,4,0) 10%), linear-gradient(90deg, rgba(20,10,4,.3), rgba(20,10,4,0) 4%)" }} />
      </div>
      {/* A low stone step near you: the lamp stands on it */}
      <div className="yard-stone absolute" style={{ left: st.x0, width: sw, top: h - st.hgt - st.d, height: st.d, transformOrigin: "50% 100%", transform: `translateZ(${st.z0}px) rotateX(90deg)`, boxShadow: "inset 0 0 0 1px rgba(255,250,240,.1), inset 0 -2px 2px rgba(255,250,240,.25)" }} />
      <div className="yard-stone absolute" style={{ left: st.x1, width: st.d, top: h - st.hgt, height: st.hgt, transformOrigin: "0 50%", transform: `translateZ(${st.z0}px) rotateY(90deg)`, filter: "sepia(.6) brightness(.55)" }} />
      <div className="yard-stone absolute" style={{ left: st.x0, width: sw, top: h - st.hgt, height: st.hgt, transform: `translateZ(${st.z0}px)`, filter: "sepia(.6) brightness(.74)", boxShadow: "inset 0 1.5px 0 rgba(255,250,240,.35), 0 2px 3px rgba(0,0,0,.5)" }} />
    </div>
  );
}

/* ----------------------------------------------------------------- balcony */
/** The railing stands this far out; the floor runs to it. */
export const RAIL_Z = -92;
const RAIL_H = 158;

export function balconyRail(c: Cam) {
  const base = project(c, c.w / 2, c.h, RAIL_Z);
  const topY = project(c, c.w / 2, c.h - RAIL_H, RAIL_Z).y;
  return { baseY: base.y, topY, k: base.k };
}

/** One bay of painted wrought iron: bars, C-scrolls, collars. Drawn in px at the railing's scale. */
function RailBay({ k }: { k: number }) {
  const bw = 46 * k;
  return (
    <pattern id="rail-bay" width={bw} height="100%" patternUnits="userSpaceOnUse" x={-bw * 0.25}>
      {[0.25, 0.75].map((f) => (
        <g key={f}>
          <rect x={bw * f - 2.2 * k} y="0" width={4.4 * k} height="2000" fill="url(#rail-iron)" />
          <rect x={bw * f - 3.6 * k} y={60 * k} width={7.2 * k} height={5 * k} rx={1.5 * k} fill="url(#rail-iron)" />
          <rect x={bw * f - 3.6 * k} y={96 * k} width={7.2 * k} height={5 * k} rx={1.5 * k} fill="url(#rail-iron)" />
        </g>
      ))}
      {/* forged rings between the bars, in the band under the handrail; a smaller one in each gap */}
      <circle cx={bw * 0.5} cy={22.5 * k} r={12.4 * k} fill="none" stroke="url(#rail-ring)" strokeWidth={3 * k} />
      <circle cx={0} cy={22.5 * k} r={5 * k} fill="none" stroke="url(#rail-ring)" strokeWidth={2.4 * k} />
      <circle cx={bw} cy={22.5 * k} r={5 * k} fill="none" stroke="url(#rail-ring)" strokeWidth={2.4 * k} />
    </pattern>
  );
}

export function BalconyRail({ cam, night }: { cam: Cam; night: boolean }) {
  const { w, h, p, oy } = cam;
  const { baseY, topY, k } = balconyRail(cam);
  const kerb = 18 * k;
  const railTop = topY;
  const handH = 11 * k;
  const ironTop = railTop + handH;
  const ironH = baseY - kerb - ironTop;
  const ceil = Math.round(h * 0.07);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* The floor out to the railing: honed grey-green stone. Overhead, the slab of the floor above. */}
      <div className="absolute inset-0" style={{ perspective: `${p}px`, perspectiveOrigin: `50% ${oy}px` }}>
        <div className="balc-ceiling absolute" style={{ left: -w, width: w * 3, top: ceil - 260, height: 260 - RAIL_Z + 16, transformOrigin: "50% 260px", transform: "rotateX(-90deg)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(255,246,230,.12), rgba(30,20,10,.25) 22%, rgba(30,20,10,.55))" }} />
        </div>
        <div className="balc-ceiling balc-fascia absolute" style={{ left: -w, width: w * 3, top: ceil, height: 15, transform: `translateZ(${RAIL_Z - 16}px)` }}>
          <div className="wall-plaster absolute inset-0" />
        </div>
        <div className="balc-floor absolute" style={{ left: -w, width: w * 3, top: h + RAIL_Z, height: -RAIL_Z, transformOrigin: "50% 100%", transform: "rotateX(90deg)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,12,10,.5), rgba(10,12,10,0) 45%)" }} />
          {!night && <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(105deg, rgba(10,14,12,0) 0 ${20 * k}px, rgba(10,14,12,.22) ${20 * k}px ${25 * k}px)`, maskImage: "linear-gradient(180deg, #000 0, #000 60%, transparent)" }} />}
        </div>
      </div>
      {/* The kerb the railing is set in */}
      <div className="balc-kerb absolute inset-x-0" style={{ top: baseY - kerb, height: kerb }} />
      {/* Painted wrought iron */}
      <svg className="absolute inset-x-0" width="100%" height={ironH} style={{ top: ironTop, filter: "drop-shadow(1px 2px 1.5px rgba(0,0,0,.45))" }}>
        <defs>
          <linearGradient id="rail-iron" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#4a524c" />
            <stop offset=".35" stopColor="#262d29" />
            <stop offset="1" stopColor="#0d110f" />
          </linearGradient>
          <linearGradient id="rail-iron-h" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#4a524c" />
            <stop offset="1" stopColor="#111614" />
          </linearGradient>
          <linearGradient id="rail-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#59625b" />
            <stop offset=".45" stopColor="#222925" />
            <stop offset="1" stopColor="#0b0e0c" />
          </linearGradient>
          <RailBay k={k} />
        </defs>
        <rect width="100%" height="100%" fill="url(#rail-bay)" />
        <rect y={ironH - 7 * k} width="100%" height={6 * k} fill="url(#rail-iron-h)" />
        <rect y={0} width="100%" height={4.5 * k} fill="url(#rail-iron-h)" />
        <rect y={41 * k} width="100%" height={4.5 * k} fill="url(#rail-iron-h)" />
      </svg>
      {/* The handrail: oiled teak, its lit top and its front */}
      <div className="win-wood-h balc-hand-top absolute inset-x-0" style={{ top: railTop - 4 * k, height: 5 * k }} />
      <div className="win-wood-h balc-hand absolute inset-x-0" style={{ top: railTop, height: handH }} />
      {/* The door you came out by: wall, then its teak frame, casting onto the view */}
      <div className="wall-paint absolute inset-y-0 left-0" style={{ width: 20 }}>
        <div className="wall-plaster absolute inset-0" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(255,248,232,.1), rgba(20,10,4,.25))" }} />
      </div>
      <div className="win-wood balc-jamb absolute inset-y-0" style={{ left: 20, width: 15 }} />
    </div>
  );
}

/* ------------------------------------------------------------- thumbnails */
/** A small, static picture of a scene for Settings (the real scene, scaled down). */
export function SceneThumb({ kind, src, wall, className }: { kind: "window" | "balcony" | "courtyard"; src: string; wall: { top: string; bottom: string }; className?: string }) {
  const W = 300;
  const H = 400;
  const cam = camFor(W, H);
  const [ref, box] = useBox<HTMLDivElement>();
  const vars = { ["--wall-top" as string]: wall.top, ["--wall-bottom" as string]: wall.bottom } as React.CSSProperties;
  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)} style={vars}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${box.w ? Math.max(box.w / W, box.h / H) : 0.3})`, visibility: box.w ? "visible" : "hidden" }}>
        {kind === "window" ? (
          <div className="wall-paint absolute inset-0">
            <div className="wall-plaster absolute inset-0" />
            <div className="absolute inset-x-[40px] bottom-[36px] top-[30px]">
              <div className="win-surround absolute inset-0" />
              <div className="win-reveal absolute inset-x-[11px] bottom-0 top-[11px]" />
              <div className="win-wood win-frame absolute inset-x-[17px] bottom-[2px] top-[17px]" />
              <div className="win-rebate absolute inset-x-[29px] bottom-[14px] top-[29px]" />
              <div className="absolute inset-x-[31px] bottom-[16px] top-[31px] overflow-hidden" style={{ borderRadius: "999px 999px 1px 1px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="win-glass absolute inset-0" />
              </div>
            </div>
            <div className="win-wood-h win-sill-face absolute inset-x-[28px] bottom-[22px] h-[16px]" />
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {kind === "balcony" ? <BalconyRail cam={cam} night={false} /> : <CourtyardRoom cam={cam} night={false} />}
          </>
        )}
      </div>
    </div>
  );
}
