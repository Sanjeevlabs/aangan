"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Suggestions } from "@/components/suggestions";
import { useShell } from "@/components/shell";
import { Avatar, EmptyLine, Icon, Photo, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { daysUntilBirthday } from "@/lib/family";
import { callName, memberPhoto } from "@/lib/people";
import type { Member } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface RitualConfig {
  slug: string;
  title: string;
  cultureNotes: string;
  steps: { key: string; kind: string; prompt: string; cardTemplate: string }[];
}
interface Run {
  id: string;
  ritualSlug: string;
  occasionDate: string;
  status: string;
}
interface Occasion {
  id: string;
  date: string;
  days: number;
  title: string;
  member: Member | null;
  config: RitualConfig | null;
  run: Run | null;
}

function whenLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function OccasionsPage() {
  const { viewer } = useViewer();
  const { openAdd } = useShell();
  const [data, setData] = useState<{ configs: RitualConfig[]; movable: Record<string, string>; members: Member[]; runs: Run[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/rituals", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("rituals"))))
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const occasions = useMemo<Occasion[]>(() => {
    if (!data) return [];
    const today = new Date();
    const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const out: Occasion[] = [];
    const birthday = data.configs.find((c) => c.slug === "birthday") ?? null;
    for (const m of data.members) {
      if (!m.birthday) continue;
      const days = daysUntilBirthday(m.birthday);
      const iso = new Date(base + days * 86_400_000).toISOString().slice(0, 10);
      out.push({
        id: `birthday:${m.id}:${iso}`,
        date: iso,
        days,
        title: m.id === viewer.id ? "Your birthday" : `${callName(m)}'s birthday`,
        member: m,
        config: birthday,
        run: data.runs.find((r) => r.ritualSlug === "birthday" && r.occasionDate === iso) ?? null,
      });
    }
    for (const c of data.configs) {
      if (c.slug === "birthday") continue;
      const iso = data.movable[c.slug];
      if (!iso) continue;
      const days = Math.round((new Date(`${iso}T00:00:00Z`).getTime() - base) / 86_400_000);
      if (days < 0) continue;
      out.push({ id: `${c.slug}:${iso}`, date: iso, days, title: c.title.replace(/\s+[—-]\s+family guide$/i, ""), member: null, config: c, run: data.runs.find((r) => r.ritualSlug === c.slug && r.occasionDate === iso) ?? null });
    }
    return out.sort((a, b) => a.days - b.days);
  }, [data, viewer.id]);

  const [next, ...rest] = occasions;

  return (
    <div>
      <RoomHeader title="Occasions" subtitle="What's coming, and your part in it" />
      <Suggestions compact />

      {failed ? (
        <EmptyLine>Couldn&rsquo;t load occasions. Pull to refresh or try again in a moment.</EmptyLine>
      ) : !data ? (
        <div className="skeleton h-[280px]" aria-busy="true" aria-label="Loading occasions" />
      ) : !next ? (
        <EmptyLine>Add birthdays in the family tree and they&rsquo;ll appear here.</EmptyLine>
      ) : (
        <>
          <article className="relative h-[300px] overflow-hidden rounded-hero bg-surface" style={{ boxShadow: "0 24px 50px -20px rgba(90,50,20,.55)" }}>
            <Photo src={memberPhoto(next.member) ?? "/demo/family-group.webp"} alt="" sizes="(max-width: 480px) 100vw, 440px" priority position="center 30%" />
            <div className="glass absolute inset-x-2.5 bottom-2.5 rounded-[22px] p-4">
              <p className="m-0 text-[13px] text-white/80">{whenLabel(next.days)}</p>
              <p className="m-0 text-[22px] font-bold leading-tight">{next.title}</p>
              <p className="m-0 mt-1 text-[14px] text-white/80">
                {next.run?.status === "delivered" ? "The family's reel is ready." : "Everyone records a short wish. Aangan plays them together on the day."}
              </p>
              <div className="mt-3 flex gap-2">
                {next.run?.status === "delivered" ? (
                  <Link href={`/reel/${encodeURIComponent(next.run.id)}`} className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-black no-underline">
                    <Icon name="play" size={16} />
                    Play the reel
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAdd("voice", next.run ? { runId: next.run.id, kind: viewer.role === "elder" ? "blessing" : "wish" } : null, next.member?.id ?? null)}
                    className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-black"
                  >
                    <Icon name="mic" size={18} />
                    {viewer.role === "elder" ? "Record a blessing" : "Record your wish"}
                  </button>
                )}
              </div>
            </div>
          </article>

          {rest.length > 0 && <h2 className="m-0 mb-1 mt-9 text-[20px]">Later</h2>}
          <ul className="m-0 list-none p-0">
            {rest.map((o) => (
              <li key={o.id} className="border-b border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setOpen((v) => (v === o.id ? null : o.id))}
                  aria-expanded={open === o.id}
                  className="press flex w-full items-center gap-3.5 py-3 text-left"
                >
                  {o.member ? (
                    <Avatar src={memberPhoto(o.member)} name={callName(o.member)} size={48} />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff4e0] text-[#8a4b00]">
                      <Icon name="calendar" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-semibold">{o.title}</span>
                    <span className="block text-[14px] text-ink-soft">{whenLabel(o.days)}</span>
                  </span>
                  <Icon name="down" size={18} className={cn("text-ink-faint transition-transform", open === o.id && "rotate-180")} />
                </button>
                {open === o.id && (
                  <div className="pb-4 pl-[62px]">
                    {o.config?.cultureNotes && o.member === null && <p className="m-0 mb-2 text-[14px] text-ink-soft">{o.config.cultureNotes}</p>}
                    {o.config && (
                      <ol className="m-0 mb-3 list-none space-y-1.5 p-0">
                        {o.config.steps.map((s) => (
                          <li key={s.key} className="text-[15px] leading-snug text-ink">
                            {s.prompt}
                          </li>
                        ))}
                      </ol>
                    )}
                    <button
                      type="button"
                      onClick={() => openAdd("voice", null, o.member?.id ?? null)}
                      className="press flex h-10 items-center gap-2 rounded-full bg-black px-4 text-[14px] font-semibold text-white"
                    >
                      <Icon name="mic" size={16} />
                      Record early
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
