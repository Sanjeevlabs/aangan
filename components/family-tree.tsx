"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { callName, memberPhoto } from "@/lib/people";
import { partnersOf } from "@/lib/households";
import type { Member, Relationship } from "@/lib/schemas";
import { Monogram, Photo } from "./ui/kit";

// The family as a living tree.
//   Trunk  — where the family began: the eldest couple, rooted in the ground.
//   Branch — each of their children; a spouse joins as a grafted twig.
//   Leaf   — the grandchildren, at the tips, in leaf-shaped frames.
// Several roots (in-laws) grow as their own trunks, and a married couple's
// branch reaches back to both. Layout is a tidy tree: every subtree gets the
// width its descendants need, so it never overlaps, at any family size.

const GEN_H = 168; // vertical distance between generations
const COUPLE_GAP = 108; // centre-to-centre of two partners
const SINGLE_W = 120;
const COUPLE_W = SINGLE_W + COUPLE_GAP;
const SIBLING_GAP = 18;
const PAD = 22;
const GROUND = 64; // space below the trunk's top node for the trunk itself

interface Unit {
  id: string;
  members: Member[];
  gen: number;
  parents: string[]; // unit ids
  children: string[]; // unit ids (primary parent only)
  x: number;
  width: number;
}

function generations(members: Member[], rels: Relationship[]): { gen: Map<string, number>; parentOf: Map<string, Set<string>>; spouse: Map<string, string> } {
  const parentOf = new Map<string, Set<string>>();
  const spouse = new Map<string, string>();
  const addParent = (child: string, parent: string) => parentOf.set(child, (parentOf.get(child) ?? new Set()).add(parent));
  for (const r of rels) {
    if (r.canonicalKind === "parent") addParent(r.memberId, r.relationMemberId);
    if (r.canonicalKind === "child") addParent(r.relationMemberId, r.memberId);
  }
  partnersOf(rels).forEach((b, a) => spouse.set(a, b));
  const ids = new Set(members.map((m) => m.id));
  const gen = new Map<string, number>();
  // Depth = longest chain of known parents above you (so in-laws line up).
  const depth = (id: string, seen = new Set<string>()): number => {
    if (gen.has(id)) return gen.get(id) as number;
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = Array.from(parentOf.get(id) ?? []).filter((p) => ids.has(p));
    const d = ps.length ? 1 + Math.max(...ps.map((p) => depth(p, seen))) : 0;
    gen.set(id, d);
    return d;
  };
  members.forEach((m) => depth(m.id));
  // Partners share a generation: the deeper one wins.
  for (let pass = 0; pass < 3; pass++) {
    spouse.forEach((b, a) => {
      if (!gen.has(a) || !gen.has(b)) return;
      const g = Math.max(gen.get(a) as number, gen.get(b) as number);
      gen.set(a, g);
      gen.set(b, g);
    });
  }
  return { gen, parentOf, spouse };
}

function layout(members: Member[], rels: Relationship[]) {
  const { gen, parentOf, spouse } = generations(members, rels);
  const units: Unit[] = [];
  const unitOf = new Map<string, string>();
  const order = [...members].sort((a, b) => (gen.get(a.id) ?? 0) - (gen.get(b.id) ?? 0) || a.id.localeCompare(b.id));
  for (const m of order) {
    if (unitOf.has(m.id)) continue;
    const partner = members.find((x) => x.id === spouse.get(m.id));
    const together = partner && !unitOf.has(partner.id) && gen.get(partner.id) === gen.get(m.id) ? [m, partner] : [m];
    // Blood relative first (the one with parents here), partner grafted beside.
    together.sort((a, b) => Number(parentOf.has(b.id)) - Number(parentOf.has(a.id)));
    const u: Unit = { id: `u-${together.map((t) => t.id).join("+")}`, members: together, gen: gen.get(m.id) ?? 0, parents: [], children: [], x: 0, width: together.length === 2 ? COUPLE_W : SINGLE_W };
    together.forEach((t) => unitOf.set(t.id, u.id));
    units.push(u);
  }
  const byId = new Map(units.map((u) => [u.id, u]));
  for (const u of units) {
    const ps = new Set<string>();
    u.members.forEach((m) => (parentOf.get(m.id) ?? new Set()).forEach((p) => unitOf.has(p) && ps.add(unitOf.get(p) as string)));
    u.parents = Array.from(ps).filter((p) => p !== u.id);
  }
  // Primary parent: the one with the biggest family (keeps the main trunk central).
  const size = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    return 1 + units.filter((c) => c.parents.includes(id)).reduce((n, c) => n + size(c.id, seen), 0);
  };
  for (const u of units) {
    if (!u.parents.length) continue;
    const primary = [...u.parents].sort((a, b) => size(b) - size(a))[0];
    byId.get(primary)?.children.push(u.id);
  }
  const width = (id: string): number => {
    const u = byId.get(id) as Unit;
    const kids = u.children.map(width);
    u.width = Math.max(u.members.length === 2 ? COUPLE_W : SINGLE_W, kids.reduce((a, b) => a + b, 0) + SIBLING_GAP * Math.max(0, kids.length - 1));
    return u.width;
  };
  const roots = units.filter((u) => !u.parents.length).sort((a, b) => size(b.id) - size(a.id));
  // Biggest family first; in-laws grow on the right, where partners are grafted.
  const arranged: Unit[] = [...roots];
  arranged.forEach((r) => width(r.id));
  const place = (id: string, left: number) => {
    const u = byId.get(id) as Unit;
    u.x = left + u.width / 2;
    const kids = u.children.map((c) => byId.get(c) as Unit);
    const total = kids.reduce((a, k) => a + k.width, 0) + SIBLING_GAP * Math.max(0, kids.length - 1);
    let cursor = u.x - total / 2;
    for (const k of kids) {
      place(k.id, cursor);
      cursor += k.width + SIBLING_GAP;
    }
  };
  let cursor = PAD;
  for (const r of arranged) {
    place(r.id, cursor);
    cursor += r.width + SIBLING_GAP * 2;
  }
  const W = Math.max(350, cursor - SIBLING_GAP * 2 + PAD);
  const maxGen = Math.max(0, ...units.map((u) => u.gen));
  const H = (maxGen + 1) * GEN_H + GROUND + 40;
  const yOf = (g: number) => H - GROUND - 70 - g * GEN_H;
  const pos = new Map<string, { x: number; y: number; unit: Unit }>();
  for (const u of units) {
    const y = yOf(u.gen);
    if (u.members.length === 2) {
      pos.set(u.members[0].id, { x: u.x - COUPLE_GAP / 2, y, unit: u });
      pos.set(u.members[1].id, { x: u.x + COUPLE_GAP / 2, y, unit: u });
    } else pos.set(u.members[0].id, { x: u.x, y, unit: u });
  }
  return { units, byId, roots: arranged, pos, W, H, maxGen, yOf };
}

/** Deterministic little leaves along a branch, for life without noise. */
function branchLeaves(x1: number, y1: number, x2: number, y2: number, seed: number) {
  const out: { x: number; y: number; r: number; c: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const t = 0.32 + i * 0.2 + ((seed * (i + 3)) % 7) / 100;
    const side = (seed + i) % 2 ? 1 : -1;
    out.push({ x: x1 + (x2 - x1) * t + side * 9, y: y1 + (y2 - y1) * t, r: side * (30 + ((seed * 13 + i * 29) % 40)), c: i % 2 ? "#9dbf7d" : "#7fa862" });
  }
  return out;
}

export function LivingTree({ members, relationships, viewerId, kin }: { members: Member[]; relationships: Relationship[]; viewerId: string; kin: Record<string, string> }) {
  const t = useMemo(() => layout(members, relationships), [members, relationships]);
  const scroller = useRef<HTMLDivElement>(null);
  // Fit the whole tree on a phone (down to 72%); scroll only beyond that.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const fit = () => setScale(Math.max(0.72, Math.min(1, (el.clientWidth - 8) / t.W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.W]);
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [scale, t.W]);
  const bark = "#8b6a4e";

  return (
    <div ref={scroller} className="no-scrollbar relative -mx-5 overflow-x-auto px-5">
      <div className="relative mx-auto" style={{ width: t.W * scale, height: t.H * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: t.W, height: t.H, transform: `scale(${scale})` }}>
        <svg width={t.W} height={t.H} className="absolute inset-0" aria-hidden="true">
          <defs>
            <linearGradient id="bark" x1="0" x2="1">
              <stop offset="0" stopColor="#7a5a40" />
              <stop offset="0.5" stopColor="#a17c5b" />
              <stop offset="1" stopColor="#7a5a40" />
            </linearGradient>
            <radialGradient id="ground" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(120,90,50,.22)" />
              <stop offset="1" stopColor="rgba(120,90,50,0)" />
            </radialGradient>
          </defs>

          {/* Trunks: one per root family, rising from the ground. */}
          {t.roots.map((r) => {
            const top = t.yOf(r.gen) + 30;
            const base = t.H - 18;
            const x = r.x;
            return (
              <g key={`trunk-${r.id}`}>
                <ellipse cx={x} cy={base + 4} rx={78} ry={12} fill="url(#ground)" />
                <path
                  d={`M${x - 26} ${base} C ${x - 14} ${base - 20}, ${x - 9} ${top + 40}, ${x - 8} ${top} L ${x + 8} ${top} C ${x + 9} ${top + 40}, ${x + 14} ${base - 20}, ${x + 26} ${base} Z`}
                  fill="url(#bark)"
                />
                <path d={`M${x - 26} ${base} q -14 6 -26 4 M${x + 26} ${base} q 14 6 26 4`} stroke={bark} strokeWidth={5} strokeLinecap="round" fill="none" />
              </g>
            );
          })}

          {/* Branches: parent home → child home; second parents (in-laws) too. */}
          {t.units.flatMap((u) =>
            u.parents.map((pid, i) => {
              const p = t.byId.get(pid) as Unit;
              const x1 = p.x;
              const y1 = t.yOf(p.gen) - 44;
              const primary = t.byId.get(pid)?.children.includes(u.id);
              // A second family's branch reaches the person who is their child.
              const child = u.members.find((m) => p.members.some((pm) => relationships.some((r) => (r.canonicalKind === "parent" && r.memberId === m.id && r.relationMemberId === pm.id) || (r.canonicalKind === "child" && r.memberId === pm.id && r.relationMemberId === m.id))));
              const x2 = !primary && child ? (t.pos.get(child.id)?.x ?? u.x) : u.x;
              const y2 = t.yOf(u.gen) + 48;
              const w = Math.max(3, 13 - u.gen * 4);
              const leaves = branchLeaves(x1, y1, x2, y2, u.id.length + i * 7);
              return (
                <g key={`${pid}-${u.id}`} opacity={primary ? 1 : 0.55}>
                  <path d={`M${x1} ${y1} C ${x1} ${y1 - 70}, ${x2} ${y2 + 80}, ${x2} ${y2}`} stroke={bark} strokeWidth={w} strokeLinecap="round" fill="none" />
                  {leaves.map((l, k) => (
                    <ellipse key={k} cx={l.x} cy={l.y} rx={8} ry={4} fill={l.c} transform={`rotate(${l.r} ${l.x} ${l.y})`} />
                  ))}
                </g>
              );
            }),
          )}

          {/* Grafts: a partner joins as a short twig. */}
          {t.units
            .filter((u) => u.members.length === 2)
            .map((u) => {
              const y = t.yOf(u.gen) + 6;
              const a = u.x - COUPLE_GAP / 2 + 36;
              const b = u.x + COUPLE_GAP / 2 - 36;
              return <path key={`graft-${u.id}`} d={`M${a} ${y} Q ${u.x} ${y + 16} ${b} ${y}`} stroke={bark} strokeWidth={5} strokeLinecap="round" fill="none" />;
            })}
        </svg>

        {members.map((m) => {
          const p = t.pos.get(m.id);
          if (!p) return null;
          const leaf = m.role === "child";
          const isRoot = p.unit.gen === 0 && !p.unit.parents.length;
          const size = leaf ? 60 : isRoot ? 74 : 66;
          const photo = memberPhoto(m);
          const label = m.id === viewerId ? "You" : callName(m);
          return (
            <Link
              key={m.id}
              href={m.id === viewerId ? "/settings" : `/people/${m.id}`}
              className="tree-node press absolute flex w-[102px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center text-ink no-underline"
              style={{ left: p.x, top: p.y + 14 }}
            >
              <span
                className="relative block overflow-hidden bg-surface"
                style={{
                  width: size,
                  height: size,
                  borderRadius: leaf ? "62% 0 62% 0" : "9999px",
                  boxShadow: leaf ? "0 0 0 3px #fff, 0 0 0 5px #8fb36f, 0 10px 22px -10px rgba(60,90,30,.6)" : "0 0 0 3px #fff, 0 0 0 4.5px rgba(139,106,78,.55), 0 12px 24px -12px rgba(80,50,20,.6)",
                }}
              >
                {photo ? <Photo src={photo} alt={label} sizes={`${size * 2}px`} position="center 30%" /> : <Monogram name={callName(m)} size={size} />}
              </span>
              <span className="mt-1.5 max-w-full truncate text-[14px] font-semibold leading-tight">{label}</span>
              <span className="max-w-full truncate text-[11.5px] leading-tight text-ink-soft">{m.id === viewerId ? m.firstName : kin[m.id] || " "}</span>
            </Link>
          );
        })}
        </div>
        <style>{`.tree-node{animation:tree-grow .42s cubic-bezier(.32,.72,0,1) both}@keyframes tree-grow{from{opacity:0;transform:translate(-50%,-40%) scale(.92)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@media (prefers-reduced-motion: reduce){.tree-node{animation:none}}`}</style>
      </div>
    </div>
  );
}

/** One line under the tree that says what the shapes mean. */
export function TreeLegend() {
  return (
    <p className="m-0 mt-2 text-center text-[12px] text-ink-faint">
      <span className="font-medium text-ink-soft">Trunk</span> where your family began · <span className="font-medium text-ink-soft">branches</span> their children · <span className="font-medium text-ink-soft">leaves</span> the grandchildren
    </p>
  );
}
