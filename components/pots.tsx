"use client";

import Link from "next/link";
import { useMemo } from "react";
import { circles } from "@/lib/circles";
import { householdName, households, type Household } from "@/lib/households";
import { callName, memberPhoto } from "@/lib/people";
import type { Member, Relationship } from "@/lib/schemas";
import { hourIn, placeFromTz, timeIn } from "@/lib/zones";
import { Icon, Photo } from "./ui/kit";
import { useViewer } from "./viewer";

// The family in pots (SPEC §28): one pot per home, a stick per person with
// their face on top, the way children make a family out of paper and sticks.
// Elders stand tallest. The parents' homes come first: they are the heroes.

const STICK = { elder: 118, adult: 98, child: 74 } as const;
const POT_COLOURS = ["#c8693f", "#b5763f", "#a35d4a", "#c2853f", "#9c6b52"];

/** A painted face when there's no photo: a soft head and shoulders, never a letter. */
function Painted({ seed }: { seed: number }) {
  const skin = ["#e9c4a6", "#d9a988", "#c48f6c", "#a8714f"][seed % 4];
  const cloth = ["#d97a8f", "#7fb069", "#5b7fb5", "#e0912f", "#8a6bb0"][seed % 5];
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="40" height="40" fill="#f4efe8" />
      <path d="M6 40c1-9 7-13 14-13s13 4 14 13z" fill={cloth} />
      <circle cx="20" cy="17" r="8.5" fill={skin} />
    </svg>
  );
}

function Pot({ home, index, labels, viewerId }: { home: Household; index: number; labels: Map<string, string>; viewerId: string }) {
  const people = [...home.members].sort((a, b) => (a.role === "elder" ? 0 : a.role === "adult" ? 1 : 2) - (b.role === "elder" ? 0 : b.role === "adult" ? 1 : 2));
  const n = people.length;
  const h = hourIn(home.tz);
  const night = h < 6 || h >= 19;
  const name = householdName(home, (m) => (m.id === viewerId ? "You" : callName(m)));
  return (
    <li className="rounded-card bg-surface px-3 pb-3 pt-2">
      <div className="relative mx-auto h-[196px] w-full max-w-[200px]">
        {people.map((m, i) => {
          const angle = n === 1 ? 0 : (i - (n - 1) / 2) * (n > 3 ? 11 : 15);
          const len = STICK[m.role];
          const photo = memberPhoto(m);
          const seed = m.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
          return (
            <div key={m.id} className="absolute bottom-[58px] left-1/2 w-[3px] origin-bottom rounded-full bg-[#b08a5a]" style={{ height: len, transform: `translateX(-50%) rotate(${angle}deg)` }}>
              <Link
                href={`/people/${m.id}`}
                aria-label={`${callName(m)}${labels.get(m.id) ? `, ${labels.get(m.id)}` : ""}`}
                className="press absolute left-1/2 top-0 block -translate-x-1/2 -translate-y-[85%] overflow-hidden rounded-full ring-[3px] ring-white"
                style={{ width: m.role === "child" ? 40 : 48, height: m.role === "child" ? 40 : 48, transform: `translate(-50%, -85%) rotate(${-angle}deg)`, boxShadow: "0 6px 14px -6px rgba(60,40,20,.45)" }}
              >
                {photo ? <Photo src={photo} alt="" sizes="96px" position="center 30%" /> : <Painted seed={seed} />}
              </Link>
            </div>
          );
        })}
        <svg viewBox="0 0 120 64" className="absolute bottom-0 left-1/2 w-[132px] -translate-x-1/2" aria-hidden="true">
          <path d="M16 14h88l-10 46a6 6 0 0 1-6 4H32a6 6 0 0 1-6-4z" fill={POT_COLOURS[index % POT_COLOURS.length]} />
          <rect x="10" y="4" width="100" height="14" rx="5" fill={POT_COLOURS[index % POT_COLOURS.length]} />
          <rect x="10" y="4" width="100" height="14" rx="5" fill="#000" opacity=".08" />
          <ellipse cx="60" cy="6" rx="46" ry="3.5" fill="#6b4a33" opacity=".55" />
        </svg>
      </div>
      <p className="m-0 mt-1 truncate text-center text-[15px] font-semibold">{name}</p>
      <p className="m-0 flex items-center justify-center gap-1 text-center text-[12.5px] text-ink-soft">
        <Icon name={night ? "moon" : "sun"} size={13} />
        {timeIn(home.tz)} · {placeFromTz(home.tz)}
      </p>
    </li>
  );
}

export function FamilyPots({ members, relationships }: { members: Member[]; relationships: Relationship[] }) {
  const { viewer } = useViewer();
  const homes = useMemo(() => {
    const all = households(members, relationships);
    const mine = (h: Household) => h.members.some((m) => m.id === viewer.id);
    // The parents' homes first, then yours, then everyone else.
    return [...all].sort((a, b) => Number(b.elders) - Number(a.elders) || Number(mine(b)) - Number(mine(a)));
  }, [members, relationships, viewer.id]);
  const labels = useMemo(() => {
    const c = circles(members, relationships, viewer.id);
    return new Map([...c.home, ...c.close, ...c.wider].map((p) => [p.member.id, p.label]));
  }, [members, relationships, viewer.id]);
  if (homes.length === 0) return null;
  return (
    <section aria-label="The family, home by home" className="mt-8">
      <h2 className="m-0 text-[20px]">Home by home</h2>
      <p className="m-0 mb-3 mt-1 text-[14px] text-ink-soft">Every pot is a home. Tap a face to open their page.</p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {homes.map((h, i) => (
          <Pot key={h.id} home={h} index={i} labels={labels} viewerId={viewer.id} />
        ))}
      </ul>
    </section>
  );
}
