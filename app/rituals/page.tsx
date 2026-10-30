"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { OccasionMonth } from "@/components/occasion-calendar";
import { OccasionCelebration } from "@/components/occasion-celebration";
import { TraditionsSheet, type TraditionChoice } from "@/components/occasion-festivals";
import { PhotoWishButton } from "@/components/occasion-wish";
import { useShell } from "@/components/shell";
import { Avatar, Icon, Photo, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { addDays, daysBetween, localTodayIso, occasionsInRange, visibleHolidays, whenLabel, type CalHoliday, type CalOccasion, type OccasionChoices } from "@/lib/occasion-calendar";
import { callName, memberPhoto } from "@/lib/people";
import type { Member, RitualRun, Wish } from "@/lib/schemas";
import { useFamilyCards } from "@/lib/use-family";
import { useJson } from "@/lib/use-json";

// Occasions: today's celebration (if any), the next few days as swipe
// cards, and a month calendar for everything else. Birthdays and national
// days always; festivals of the traditions the family celebrates (one
// family-level choice), plus any switched on or off by hand.

interface Data {
  holidays: CalHoliday[];
  holidaySource: "google" | "fallback";
  countryName: string;
  traditionChoices: TraditionChoice[];
  traditions: string[];
  kept: string[];
  skipped: string[];
  members: Member[];
  runs: RitualRun[];
  wishes: Wish[];
  canEditKept: boolean;
}

/** How many days ahead the family is asked for wishes. */
const ASK_DAYS = 7;

const SOON_DAYS = 10;

export default function OccasionsPage() {
  const { viewer } = useViewer();
  const { openAdd, refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const { data, failed, reload } = useJson<Data>(`/api/rituals?k=${refreshKey}`);
  const [saved, setSaved] = useState<OccasionChoices | null>(null);
  const [festivalsOpen, setFestivalsOpen] = useState(false);
  const today = localTodayIso();
  const choices = useMemo<OccasionChoices>(() => saved ?? { traditions: data?.traditions ?? [], kept: data?.kept ?? [], skipped: data?.skipped ?? [] }, [saved, data]);
  const shownHolidays = useMemo(() => (data ? visibleHolidays(data.holidays, choices) : []), [data, choices]);

  const occasionsFor = useCallback(
    (start: string, end: string): CalOccasion[] => (data ? occasionsInRange(data.members, shownHolidays, start, end) : []),
    [data, shownHolidays],
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
  // Muse's ask, a week out: every grown-up records a wish (voice or photo).
  const ask =
    viewer.role === "child"
      ? null
      : (soon.find((o) => o.kind !== "national" && o.date !== today && daysBetween(today, o.date) <= ASK_DAYS && o.memberId !== viewer.id && runOf(o) && !wishedBy(o).some((w) => w.memberId === viewer.id)) ?? null);
  const askRun = ask ? runOf(ask) : null;
  const sourceLine = data ? (data.holidaySource === "google" ? `Festival dates from Google\u2019s public holiday calendar for ${data.countryName}.` : `Festival dates from Aangan\u2019s own list for ${data.countryName}.`) : "";

  return (
    <div>
      <RoomHeader
        title="Occasions"
        subtitle="Birthdays, national days and your festivals"
        action={
          data ? (
            <button type="button" onClick={() => setFestivalsOpen(true)} aria-label="Our traditions" className="press grid h-11 w-11 place-items-center rounded-full bg-surface">
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
            <OccasionCelebration key={o.id} title={titleOf(o)} person={memberOf(o)} members={data.members} viewer={viewer} run={runOf(o)} wishes={wishedBy(o)} cards={cards ?? []} lampHour={o.kind === "festival" ? o.lampHour : null} onWish={() => wish(o)} onWished={() => void reload()} />
          ))}

          {ask && askRun && (
            <section aria-label="Wish ahead" className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
              {memberOf(ask) ? <Avatar src={memberPhoto(memberOf(ask))} name={callName(memberOf(ask) as Member)} size={44} /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink"><Icon name="flower" size={20} /></span>}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug">Record a {viewer.role === "elder" ? "blessing" : "wish"} for {titleOf(ask)}</span>
                <span className="block text-[13px] text-ink-soft">{whenLabel(daysBetween(today, ask.date), ask.date)} · it plays with everyone&rsquo;s on the day</span>
              </span>
              <button type="button" onClick={() => wish(ask)} aria-label={`Record a voice wish for ${titleOf(ask)}`} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white">
                <Icon name="mic" size={18} />
              </button>
              <PhotoWishButton run={askRun} viewer={viewer} forName={memberOf(ask) ? callName(memberOf(ask) as Member) : ask.title} onDone={() => void reload()} className="h-11 w-11 bg-white text-ink" />
            </section>
          )}

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
                  const national = o.kind === "national";
                  return (
                    <article key={o.id} className="relative h-[180px] w-[78%] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-hero bg-[#1c1c1e] text-white">
                      {m ? <Photo src={memberPhoto(m) ?? "/demo/family-group.webp"} alt="" sizes="300px" position="center 30%" /> : <Photo src="/demo/family-group.webp" alt="" sizes="300px" />}
                      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.7))]" aria-hidden="true" />
                      <div className="absolute inset-x-3.5 bottom-3">
                        <p className="m-0 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-white/75">{whenLabel(days, o.date)}</p>
                        <p className="m-0 text-[19px] font-bold leading-tight">{titleOf(o)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          {national ? (
                            <span className="flex h-10 items-center gap-1.5 text-[13px] text-white/80">
                              <Icon name="calendar" size={16} />
                              National day
                            </span>
                          ) : !mine && !iWished ? (
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
                          <Icon name={o.kind === "festival" ? "flower" : "calendar"} size={18} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{titleOf(o)}</span>
                        <span className="block text-[13px] text-ink-soft">{days < 0 ? "Passed" : whenLabel(days, iso)}</span>
                      </span>
                      {days >= 0 && o.kind !== "national" && m?.id !== viewer.id && (
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

          {choices.traditions.length === 0 && choices.kept.length === 0 && data.canEditKept && (
            <button type="button" onClick={() => setFestivalsOpen(true)} className="press flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-left">
              <Icon name="flower" size={20} className="text-ink-soft" />
              <span className="min-w-0 flex-1 text-[14px] text-ink-soft">Showing birthdays and national days. Which traditions does your family celebrate?</span>
              <Icon name="chevron" size={18} className="text-ink-faint" />
            </button>
          )}
        </div>
      )}

      {data && (
        <TraditionsSheet
          open={festivalsOpen}
          choices={data.traditionChoices}
          holidays={data.holidays}
          value={choices}
          today={today}
          sourceLine={sourceLine}
          canEdit={data.canEditKept}
          onClose={() => setFestivalsOpen(false)}
          onSaved={(v) => {
            setSaved(v);
            void reload();
          }}
        />
      )}
    </div>
  );
}
