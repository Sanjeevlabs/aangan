"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { constellation, familyStats, type Placed } from "@/lib/constellation";
import { households } from "@/lib/households";
import { callName, memberPhoto } from "@/lib/people";
import { constellationPoster, shareOrDownload, type PosterPerson } from "@/lib/poster";
import type { Member, Relationship } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Icon, Monogram, Photo } from "./ui/kit";

// The family as a constellation around one person. Up = the generations
// before, sides = your generation and your partner, down = the ones after;
// each further ring is one more step of kinship. One line per person, so
// lines never cross. Tap anyone to see the family from where they stand.

const PAD = 70;
const GEN = {
  before: { ring: "#d39a3a", line: "rgba(211,154,58,.6)", label: "Generations before" },
  same: { ring: "#5b7fb5", line: "rgba(91,127,181,.55)", label: "Same generation" },
  after: { ring: "#5f9a4a", line: "rgba(95,154,74,.6)", label: "Generations after" },
} as const;
const tone = (n: Placed) => (n.depth < 0 ? null : n.gen < 0 ? GEN.before : n.gen > 0 ? GEN.after : GEN.same);
const sizeOf = (n: Placed) => (n.depth === 0 ? 88 : n.depth === 1 ? 62 : n.depth === 2 ? 54 : 48);

export function FamilyConstellation({
  members,
  relationships,
  viewerId,
  familyName,
  onFocusChange,
  onAdd,
}: {
  members: Member[];
  relationships: Relationship[];
  viewerId: string;
  familyName?: string;
  onFocusChange?: (id: string) => void;
  onAdd?: (anchorId: string) => void;
}) {
  const router = useRouter();
  const [focus, setFocus] = useState(viewerId);
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
  const [posting, setPosting] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [height, setHeight] = useState(640);
  useEffect(() => setFocus(viewerId), [viewerId]);
  useEffect(() => onFocusChange?.(focus), [focus, onFocusChange]);

  const c = useMemo(() => constellation(members, relationships, focus), [members, relationships, focus]);
  const byId = useMemo(() => new Map(members.map((x) => [x.id, x])), [members]);
  const pos = useMemo(() => new Map(c.nodes.map((n) => [n.id, n])), [c]);
  const stats = familyStats(c, members);
  const homes = households(members, relationships).length;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      setWidth(el.clientWidth);
      setHeight(el.clientHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);
  useEffect(() => {
    if (!full) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [full]);

  const half = Math.max(-c.bounds.minX, c.bounds.maxX) + PAD;
  const top = -c.bounds.minY + PAD + 6;
  const bottom = c.bounds.maxY + PAD + 30;
  const W = half * 2;
  const H = top + bottom;
  const fitScale = full ? Math.max(0.42, Math.min(1.6, width / W, (height - 90) / H)) : Math.max(0.42, Math.min(1.1, width / W));
  const scale = fitScale * zoom;
  const ox = half;
  const oy = top;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, ox * scale - el.clientWidth / 2), top: full ? Math.max(0, oy * scale - el.clientHeight / 2) : 0, behavior: "smooth" });
  }, [ox, oy, scale, focus, full]);

  const focusMember = byId.get(focus);
  const kinOf = (n: Placed) => (n.depth === 0 ? (n.id === viewerId ? "You" : "At the centre") : n.label || "Family");

  const poster = async () => {
    setPosting(true);
    const people = new Map<string, PosterPerson>(
      c.nodes.flatMap((n) => {
        const who = byId.get(n.id);
        if (!who) return [];
        const photo = memberPhoto(who);
        return [[n.id, { id: n.id, name: n.depth === 0 ? who.firstName : callName(who), label: n.depth === 0 ? "" : n.label, photo: photo && photo.startsWith("/") ? photo : null, ring: tone(n)?.ring ?? "#ccc" }] as const];
      }),
    );
    const blob = await constellationPoster(c, people, familyName ? `The ${familyName} family` : "Our family", `${stats.people} people · ${stats.generations} generations · ${homes} homes · ${stats.zones} time zones`);
    setPosting(false);
    if (blob) await shareOrDownload(blob, "our-family.png", "Our family, all in one place");
  };

  const canvas = (
    <div ref={box} className={cn("no-scrollbar overflow-auto", full && "flex h-full")} style={full ? undefined : { maxHeight: "74vh" }}>
      <div className={cn("relative mx-auto shrink-0", full && "my-auto")} style={{ width: W * scale, height: H * scale }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <svg width={W} height={H} className="absolute inset-0" aria-hidden="true">
            <defs>
              <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="rgba(242,165,22,.22)" />
                <stop offset="1" stopColor="rgba(242,165,22,0)" />
              </radialGradient>
            </defs>
            <circle cx={ox} cy={oy} r={120} fill="url(#glow)" />
            {c.rings.map((r) => (
              <circle key={r} cx={ox} cy={oy} r={r} fill="none" stroke="rgba(0,0,0,.055)" strokeDasharray="2 8" strokeWidth={1.5} strokeLinecap="round" />
            ))}
            {c.links.map((l) => {
              const a = pos.get(l.from);
              const b = pos.get(l.to);
              if (!a || !b) return null;
              const t = tone(a.depth > b.depth ? a : b) ?? GEN.same;
              return (
                <m.line
                  key={`${l.from}-${l.to}`}
                  initial={false}
                  animate={{ x1: a.x + ox, y1: a.y + oy, x2: b.x + ox, y2: b.y + oy }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  stroke={l.kind === "spouse" ? "#f2a516" : t.line}
                  strokeWidth={l.kind === "spouse" ? 3.5 : Math.min(a.depth, b.depth) === 0 ? 3 : 2.2}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {c.nodes.map((n) => {
            const who = byId.get(n.id);
            if (!who) return null;
            const s = sizeOf(n);
            const t = tone(n);
            const photo = memberPhoto(who);
            const isFocus = n.depth === 0;
            const kin = kinOf(n);
            return (
              <m.button
                key={n.id}
                type="button"
                initial={{ opacity: 0, left: ox - 48, top: oy - s / 2 }}
                animate={{ opacity: 1, left: n.x + ox - 48, top: n.y + oy - s / 2 }}
                transition={{ type: "spring", stiffness: 120, damping: 20, delay: Math.max(0, n.depth) * 0.04 }}
                onClick={() => (isFocus ? router.push(n.id === viewerId ? "/settings" : `/people/${n.id}`) : setFocus(n.id))}
                aria-label={isFocus ? `${callName(who)}, at the centre. Open profile` : `${callName(who)}, ${kin}. Put at the centre`}
                className="press absolute flex w-[96px] flex-col items-center text-center text-ink"
              >
                <span
                  className="relative block overflow-hidden rounded-full bg-surface"
                  style={{
                    width: s,
                    height: s,
                    boxShadow: isFocus ? "0 0 0 4px #fff, 0 0 0 7px #111, 0 18px 36px -14px rgba(0,0,0,.45)" : `0 0 0 3px #fff, 0 0 0 5.5px ${t?.ring ?? "#c9c9c9"}, 0 10px 22px -12px rgba(0,0,0,.35)`,
                  }}
                >
                  {photo ? <Photo src={photo} alt="" sizes={`${s * 2}px`} position="center 30%" /> : <Monogram name={callName(who)} size={s} />}
                </span>
                <span className={cn("mt-2 max-w-full truncate rounded-full bg-white/85 px-1.5 font-semibold leading-tight", isFocus ? "text-[16px]" : "text-[13.5px]")}>{n.id === viewerId ? "You" : callName(who)}</span>
                <span className="max-w-full truncate rounded-full bg-white/70 px-1 text-[11.5px] leading-tight text-ink-soft">{isFocus ? (n.id === viewerId ? who.firstName : "at the centre") : kin}</span>
              </m.button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const controls = (
    <div className={cn("flex items-center justify-between gap-2", full ? "absolute inset-x-4 bottom-4" : "mt-3")} style={full ? { bottom: "calc(16px + env(safe-area-inset-bottom))" } : undefined}>
      <div className="flex min-w-0 gap-1.5">
        {focus !== viewerId && (
          <button type="button" onClick={() => setFocus(viewerId)} className="press flex h-10 shrink-0 items-center gap-1 rounded-full bg-black pl-2.5 pr-4 text-[14px] font-semibold text-white">
            <Icon name="back" size={16} />
            Me
          </button>
        )}
        {onAdd && focusMember && (
          <button
            type="button"
            onClick={() => {
              setFull(false);
              onAdd(focus);
            }}
            className="press flex h-10 min-w-0 items-center gap-1 rounded-full bg-surface pl-2.5 pr-4 text-[14px] font-semibold"
          >
            <Icon name="plus" size={16} />
            <span className="truncate">Add to {focus === viewerId ? "me" : callName(focusMember)}</span>
          </button>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))} className="press grid h-10 w-10 place-items-center rounded-full bg-surface text-[20px] font-semibold">
          −
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))} className="press grid h-10 w-10 place-items-center rounded-full bg-surface text-[20px] font-semibold">
          +
        </button>
        <button type="button" aria-label={full ? "Close full screen" : "Full screen"} onClick={() => setFull((f) => !f)} className="press grid h-10 w-10 place-items-center rounded-full bg-black text-white">
          {full ? (
            <Icon name="close" size={16} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* The numbers families are proud of. */}
      <div className="mb-4 rounded-[28px] bg-[linear-gradient(135deg,#1c1712,#3a2a1c)] p-5 text-white">
        <p className="m-0 text-[13px] font-medium uppercase tracking-[0.1em] text-white/60">{familyName ? `The ${familyName} family` : "Your family"}</p>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-[56px] font-bold leading-none">{stats.people}</span>
          <span className="mb-1.5 text-[17px] font-medium text-white/80">people, one family</span>
        </div>
        <dl className="m-0 mt-4 grid grid-cols-3 gap-2">
          {(
            [
              [stats.generations, stats.generations > 1 ? "generations" : "generation"],
              [homes, homes > 1 ? "homes" : "home"],
              [stats.zones, stats.zones > 1 ? "time zones" : "time zone"],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="rounded-[16px] bg-white/10 px-2 py-2.5 text-center">
              <dd className="m-0 text-[22px] font-bold leading-none">{n}</dd>
              <dt className="mt-1 text-[12px] font-medium text-white/70">{label}</dt>
            </div>
          ))}
        </dl>
        <button type="button" onClick={() => void poster()} disabled={posting} className="press mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[15px] font-semibold text-ink disabled:opacity-60">
          <Icon name="send" size={16} />
          {posting ? "Drawing your family…" : "Share our family poster"}
        </button>
      </div>

      {full ? (
        <div className="fixed inset-0 z-50 bg-[radial-gradient(ellipse_at_center,#fffaf0_0%,#ffffff_62%)]" role="dialog" aria-modal="true" aria-label="Family, full screen">
          {canvas}
          {controls}
        </div>
      ) : (
        <>
          <div className="-mx-5 overflow-hidden rounded-[28px] bg-[radial-gradient(ellipse_at_center,#fffaf0_0%,#ffffff_62%)]">{canvas}</div>
          {controls}
        </>
      )}

      <p className="m-0 mt-2 text-[13px] text-ink-soft">{focusMember && focus !== viewerId ? `The family as ${callName(focusMember)} sees it. Tap them again to open their page.` : "Tap anyone to see the family from where they stand."}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft" aria-label="Legend">
        {Object.values(GEN).map((g) => (
          <span key={g.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.ring }} aria-hidden="true" />
            {g.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-[#f2a516]" aria-hidden="true" />
          Couple
        </span>
      </div>
    </div>
  );
}
