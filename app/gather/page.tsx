"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayer } from "@/components/player";
import { Avatar, Button, EmptyLine, Icon, Photo, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { callName, cardCover, memberPhoto } from "@/lib/people";
import type { Card, Member } from "@/lib/schemas";
import { useFamilyCards } from "@/lib/use-family";
import { cn } from "@/lib/utils";

interface GatherSession {
  id: string;
  title: string;
  startsAt: string;
  invites: string[];
  playlist: string[];
}

function at(tz: string, iso: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(new Date(iso));
  } catch {
    return "";
  }
}

function hourAt(tz: string, iso: string): number {
  return Number(at(tz, iso, { hour: "numeric", hour12: false })) % 24;
}

/** ISO instant for a wall-clock time in a given zone (offset found by probing). */
function zonedIso(y: number, mo: number, d: number, h: number, tz: string): string {
  const guess = Date.UTC(y, mo, d, h, 0, 0);
  const asTz = new Date(new Date(guess).toLocaleString("en-US", { timeZone: tz }));
  const asUtc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess - (asTz.getTime() - asUtc.getTime())).toISOString();
}

const awake = (h: number) => h >= 8 && h < 22;

/**
 * Weekend evenings at 7 pm in the viewer's zone, plus the hour that keeps the
 * most family members awake (8 am to 10 pm locally).
 */
function quickPicks(viewerTz: string, members: Member[]): { label: string; iso: string }[] {
  const out: { label: string; iso: string }[] = [];
  const now = new Date();
  let firstWeekend: Date | null = null;
  for (let i = 1; out.length < 2 && i < 14; i++) {
    const c = new Date(now.getTime() + i * 86_400_000);
    const day = new Date(c.toLocaleString("en-US", { timeZone: viewerTz })).getDay();
    if (day === 6 || day === 0) {
      firstWeekend ??= c;
      const parts = new Date(c.toLocaleString("en-US", { timeZone: viewerTz }));
      out.push({ label: `${parts.toLocaleDateString("en-US", { weekday: "long" })} 7 pm`, iso: zonedIso(parts.getFullYear(), parts.getMonth(), parts.getDate(), 19, viewerTz) });
    }
  }
  if (firstWeekend && members.length > 1) {
    const p = new Date(firstWeekend.toLocaleString("en-US", { timeZone: viewerTz }));
    let best: { iso: string; score: number; h: number } | null = null;
    for (let h = 7; h <= 23; h++) {
      const iso = zonedIso(p.getFullYear(), p.getMonth(), p.getDate(), h, viewerTz);
      const score = members.filter((m) => awake(hourAt(m.tz || "UTC", iso))).length;
      if (!best || score > best.score || (score === best.score && Math.abs(h - 19) < Math.abs(best.h - 19))) best = { iso, score, h };
    }
    if (best && !out.some((o) => o.iso === best!.iso)) {
      const label = new Date(best.iso).toLocaleString("en-US", { timeZone: viewerTz, weekday: "short", hour: "numeric" });
      out.unshift({ label: best.score === members.length ? `Best for everyone · ${label}` : `Best fit · ${label}`, iso: best.iso });
    }
  }
  return out;
}

function TimesAround({ members, iso }: { members: Member[]; iso: string }) {
  return (
    <ul className="m-0 list-none p-0">
      {members.map((m) => {
        const h = hourAt(m.tz || "UTC", iso);
        const late = h >= 22 || h < 7;
        return (
          <li key={m.id} className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 last:border-0">
            <Avatar src={memberPhoto(m)} name={callName(m)} size={36} />
            <span className="flex-1 text-[15px] font-medium">{callName(m)}</span>
            <span className={cn("tnum text-[15px]", late ? "font-semibold text-[#b42318]" : "text-ink-soft")}>
              {at(m.tz || "UTC", iso, { weekday: "short", hour: "numeric", minute: "2-digit" })}
              {late ? " · late" : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function GatherPage() {
  const { members, viewer } = useViewer();
  const { play } = usePlayer();
  const { cards } = useFamilyCards();
  const [sessions, setSessions] = useState<GatherSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const picks = useMemo(() => quickPicks(viewer.tz || "UTC", members), [viewer.tz, members]);
  const [when, setWhen] = useState<string>(picks[0]?.iso ?? new Date().toISOString());
  useEffect(() => {
    if (picks[0]) setWhen(picks[0].iso);
  }, [picks]);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/gather", { cache: "no-store" });
      if (!res.ok) throw new Error("gather");
      setSessions(((await res.json()) as { sessions: GatherSession[] }).sessions);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const plan = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/gather", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Family evening", startsAt: when, invites: members.map((m) => m.id) }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  };

  const upcoming = (sessions ?? []).filter((s) => new Date(s.startsAt).getTime() > Date.now() - 3 * 3_600_000).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const playlist = upcoming ? upcoming.playlist.map((id) => (cards ?? []).find((c) => c.id === id)).filter((c): c is Card => Boolean(c)) : [];

  return (
    <div>
      <RoomHeader title="Gather" subtitle="An evening together, wherever everyone is" />

      {failed && <EmptyLine>Couldn&rsquo;t load your evenings. Try again in a moment.</EmptyLine>}

      {upcoming && (
        <article className="mb-9 overflow-hidden rounded-hero bg-[#1d1714] text-white" style={{ boxShadow: "0 24px 50px -20px rgba(40,20,10,.6)" }}>
          <div className="grid h-[180px] grid-cols-3 gap-0.5">
            {(playlist.length ? playlist : []).slice(0, 3).map((c) => (
              <div key={c.id} className="relative">
                <Photo src={cardCover(c, members)} alt="" sizes="160px" />
              </div>
            ))}
            {playlist.length === 0 && (
              <div className="relative col-span-3">
                <Photo src="/demo/family-group.webp" alt="" sizes="440px" />
              </div>
            )}
          </div>
          <div className="p-5">
            <p className="m-0 text-[13px] text-white/65">{new Date(upcoming.startsAt).toLocaleString("en-US", { timeZone: viewer.tz || undefined, weekday: "long", hour: "numeric", minute: "2-digit" })} your time</p>
            <p className="m-0 text-[22px] font-bold">{upcoming.title}</p>
            <p className="m-0 mt-1 text-[14px] text-white/70">{playlist.length > 0 ? `Aangan picked ${playlist.length} memories to play together` : "Aangan will pick memories to play together"}</p>
            <button
              type="button"
              disabled={playlist.length === 0}
              onClick={() => playlist[0] && play(playlist[0])}
              className="press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-black disabled:opacity-40"
            >
              <Icon name="play" size={16} />
              Start together
            </button>
          </div>
        </article>
      )}

      <section aria-label="Plan an evening">
        <h2 className="m-0 mb-3 text-[20px]">{upcoming ? "Plan another" : "Plan an evening"}</h2>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label="When">
          {picks.map((p) => (
            <button
              key={p.iso}
              type="button"
              role="radio"
              aria-checked={!custom && when === p.iso}
              onClick={() => {
                setCustom(false);
                setWhen(p.iso);
              }}
              className={cn("press h-11 shrink-0 rounded-full px-4 text-[15px] font-medium", !custom && when === p.iso ? "bg-black text-white" : "bg-surface")}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            onClick={() => setCustom(true)}
            className={cn("press h-11 shrink-0 rounded-full px-4 text-[15px] font-medium", custom ? "bg-black text-white" : "bg-surface")}
          >
            Other time
          </button>
        </div>
        {custom && (
          <label className="mt-3 block">
            <span className="sr-only">Date and time, in your time zone</span>
            <input
              type="datetime-local"
              onChange={(e) => e.target.value && setWhen(new Date(e.target.value).toISOString())}
              className="h-[52px] w-full rounded-full bg-surface px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold"
            />
          </label>
        )}
        <p className="m-0 mb-1 mt-5 text-[13px] font-medium text-ink-soft">That&rsquo;s</p>
        <TimesAround members={members} iso={when} />
        <Button className="mt-5 w-full" disabled={busy} onClick={() => void plan()}>
          {busy ? "Inviting…" : "Invite everyone"}
        </Button>
      </section>
    </div>
  );
}
