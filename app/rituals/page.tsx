"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { OccasionMonth } from "@/components/occasion-calendar";
import { OccasionCelebration } from "@/components/occasion-celebration";
import { FestivalsSheet } from "@/components/occasion-festivals";
import { useShell } from "@/components/shell";
import { Avatar, Icon, Photo, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { addDays, daysBetween, localTodayIso, occasionsInRange, whenLabel, type CalOccasion, type OccasionConfig } from "@/lib/occasion-calendar";
import { callName, memberPhoto } from "@/lib/people";
import type { Member, RitualRun, Wish } from "@/lib/schemas";
import { useFamilyCards } from "@/lib/use-family";
import { useJson } from "@/lib/use-json";

// Occasions: today's celebration (if any), the next few days as swipe
// cards, and a month calendar for everything else. Birthdays always; a
// festival only when the family keeps it (one family-level list).

interface Data {
  configs: OccasionConfig[];
  movable: Record<string, string>;
  members: Member[];
  runs: RitualRun[];
  wishes: Wish[];
  kept: string[];
  canEditKept: boolean;
}

const SOON_DAYS = 10;

export default function OccasionsPage() {
  const { viewer } = useViewer();
  const { openAdd, refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const { data, failed, reload } = useJson<Data>(`/api/rituals?k=${refreshKey}`);
  const [kept, setKept] = useState<string[] | null>(null);
  const [festivalsOpen, setFestivalsOpen] = useState(false);
  const today = localTodayIso();
  const keptNow = kept ?? data?.kept ?? [];

  const occasionsFor = useCallback(
    (start: string, end: string): CalOccasion[] => (data ? occasionsInRange(data.members, data.configs, data.movable, keptNow, start, end) : []),
    [data, keptNow],
  );
  const soon = useMemo(() => occasionsFor(today, addDays(today, SOON_DAYS)), [occasionsFor, today]);
  const todays = soon.filter((o) => o.date === today);
  const upcoming = soon.filter((o) => o.date !== today).slice(0, 3);

  const memberOf = (o: CalOccasion) => (o.memberId ? (data?.members.find((m) => m.id === o.memberId) ?? null) : null);
  const titleOf = (o: CalOccasion) => {
    const m = memberOf(o);
    if (!m) return o.title;
    return m.id === viewer.id ? "Your birthday" : `${callName(m)}'s birthday`;
  };
  const runOf = (o: CalOccasion) => data?.runs.find((r) => r.ritualSlug === o.slug && r.occasionDate === o.date) ?? null;
  const wish = (o: CalOccasion) => {
    // Runs exist for the next 10 days (the API opens them); further out, the
    // wish is a plain voice note to the person.
    const run = runOf(o);
    openAdd("voice", run ? { runId: run.id, kind: viewer.role === "elder" ? "blessing" : "wish" } : null, o.memberId);
  };
  const wishedBy = (o: CalOccasion) => {
    const run = runOf(o);
    return run ? (data?.wishes ?? []).filter((w) => w.ritualRunId === run.id) : [];
  };

  return (
    <div>
      <RoomHeader
        title="Occasions"
        subtitle="Birthdays and the festivals you keep"
        action={
          data ? (
            <button type="button" onClick={() => setFestivalsOpen(true)} aria-label="Festivals we keep" className="press grid h-11 w-11 place-items-center rounded-full bg-surface">
              <Icon name="settings" size={20} />
            </button>
          ) : undefined
        }
      />

      {failed ? (
        <div className="py-6 text-center">
          <p className="m-0 text-[15px] text-ink-soft">Couldn&rsquo;t load occasions.</p>
          <button type="button" onClick={() => void reload()} className="press mt-3 h-11 rounded-full bg-ink px-5 text-[15px] font-semibold text-white">
            Try again
          </button>
        </div>
      ) : !data ? (
        <div aria-busy="true" aria-label="Loading occasions">
          <div className="skeleton h-[180px] rounded-hero" />
          <div className="skeleton mt-5 h-[300px] rounded-card" />
        </div>
      ) : (
        <div className="space-y-5">
          {todays.map((o) => (
            <OccasionCelebration key={o.id} title={titleOf(o)} person={memberOf(o)} members={data.members} viewer={viewer} run={runOf(o)} wishes={wishedBy(o)} cards={cards ?? []} onWish={() => wish(o)} />
          ))}

          <section aria-label="Coming up">
            <h2 className="m-0 mb-2 text-[18px]">Coming up</h2>
            {upcoming.length === 0 ? (
              data.members.some((m) => m.birthday) ? (
                <p className="m-0 rounded-card bg-surface px-4 py-5 text-center text-[14px] text-ink-soft">Nothing in the next {SOON_DAYS} days. The calendar has the rest.</p>
              ) : (
                <div className="rounded-card bg-surface px-4 py-5 text-center">
                  <p className="m-0 text-[14px] text-ink-soft">Add birthdays in the family tree and they&rsquo;ll appear here.</p>
                  <Link href="/tree" className="press mt-3 inline-flex h-10 items-center rounded-full bg-ink px-4 text-[14px] font-semibold text-white no-underline">
                    Open the tree
                  </Link>
                </div>
              )
            ) : (
              <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2.5 overflow-x-auto px-5 pb-1">
                {upcoming.map((o) => {
                  const m = memberOf(o);
                  const days = daysBetween(today, o.date);
                  const run = runOf(o);
                  const n = wishedBy(o).length;
                  const iWished = wishedBy(o).some((w) => w.memberId === viewer.id);
                  const mine = m?.id === viewer.id;
                  return (
                    <article key={o.id} className="relative h-[180px] w-[78%] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-hero bg-[#1c1c1e] text-white">
                      {m ? <Photo src={memberPhoto(m) ?? "/demo/family-group.webp"} alt="" sizes="300px" position="center 30%" /> : <Photo src="/demo/family-group.webp" alt="" sizes="300px" />}
                      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.7))]" aria-hidden="true" />
                      <div className="absolute inset-x-3.5 bottom-3">
                        <p className="m-0 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-white/75">{whenLabel(days, o.date)}</p>
                        <p className="m-0 text-[19px] font-bold leading-tight">{titleOf(o)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          {!mine && !iWished ? (
                            <button type="button" onClick={() => wish(o)} className="press flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[14px] font-semibold text-black">
                              <Icon name="mic" size={16} />
                              Record a wish
                            </button>
                          ) : (
                            <span className="flex h-10 items-center gap-1.5 text-[13px] text-white/80">
                              <Icon name="check" size={16} />
                              {mine ? "Wishes are on their way" : "You wished"}
                            </span>
                          )}
                          {n > 0 && run && (
                            <span className="ml-auto text-[12.5px] text-white/75">
                              {n} wish{n > 1 ? "es" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <OccasionMonth
            today={today}
            occasionsFor={occasionsFor}
            renderDay={(iso, list) => (
              <ul className="m-0 list-none p-0">
                {list.map((o) => {
                  const m = memberOf(o);
                  const days = daysBetween(today, iso);
                  return (
                    <li key={o.id} className="flex items-center gap-3 py-1.5">
                      {m ? (
                        <Avatar src={memberPhoto(m)} name={callName(m)} size={40} />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink">
                          <Icon name="calendar" size={18} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{titleOf(o)}</span>
                        <span className="block text-[13px] text-ink-soft">{days < 0 ? "Passed" : whenLabel(days, iso)}</span>
                      </span>
                      {days >= 0 && m?.id !== viewer.id && (
                        <button type="button" onClick={() => wish(o)} aria-label={`Record a wish for ${titleOf(o)}`} className="press grid h-10 w-10 place-items-center rounded-full bg-ink text-white">
                          <Icon name="mic" size={18} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          />

          {keptNow.length === 0 && data.configs.some((c) => c.slug !== "birthday") && (
            <button type="button" onClick={() => setFestivalsOpen(true)} className="press flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-left">
              <Icon name="calendar" size={20} className="text-ink-soft" />
              <span className="min-w-0 flex-1 text-[14px] text-ink-soft">Showing birthdays only. Add the festivals your family keeps.</span>
              <Icon name="chevron" size={18} className="text-ink-faint" />
            </button>
          )}
        </div>
      )}

      {data && <FestivalsSheet open={festivalsOpen} configs={data.configs} kept={keptNow} canEdit={data.canEditKept} onClose={() => setFestivalsOpen(false)} onSaved={(k) => { setKept(k); void reload(); }} />}
    </div>
  );
}
