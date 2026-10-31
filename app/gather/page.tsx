"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, EmptyLine, Icon, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import type { Knock, Question, Recipe, Sitting } from "@/lib/kinds";
import { awakeWindows, icsFor, roomUrl, suggestTimes } from "@/lib/overlap";
import { callName, memberPhoto } from "@/lib/people";
import type { Member } from "@/lib/schemas";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { hourIn, isAwake, placeFromTz, timeIn } from "@/lib/zones";

type Reason = Sitting["reason"];

// Why people sit together. Each reason carries a purpose for the call, so it
// never feels like a meeting: something to do, hear or keep together.
const REASONS: { id: Reason; label: string; title: (ctx: { elder?: string; recipe?: string }) => string; hint: string }[] = [
  { id: "chai", label: "Chai", title: () => "Chai together", hint: "Two cups, two kitchens, one table." },
  { id: "cook", label: "Cook together", title: (c) => (c.recipe ? `Cook ${c.recipe} together` : "Cook together"), hint: "One person guides from their stove, everyone cooks along." },
  { id: "story", label: "Story night", title: (c) => (c.elder ? `${c.elder}'s story night` : "Story night"), hint: "One question, one storyteller, everyone listens." },
  { id: "festival", label: "Festival", title: () => "Celebrate together", hint: "Light the lamp at the same moment, wherever you are." },
  { id: "birthday", label: "Birthday", title: () => "Birthday together", hint: "Sing at once. The Reel plays for everyone." },
  { id: "music", label: "Songs", title: () => "Old songs evening", hint: "Everyone brings one song that reminds them of home." },
  { id: "just-sit", label: "Just sit", title: () => "Just sit together", hint: "No agenda. Leave the call on while you do your evening." },
];

function fmt(tz: string, d: Date | string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(typeof d === "string" ? new Date(d) : d);
  } catch {
    return "";
  }
}

export default function SitTogetherPage() {
  const { viewer, members } = useViewer();
  const { data, reload } = useJson<{ sittings: Sitting[]; knocks: Knock[] }>("/api/sit");
  const kitchen = useJson<{ recipes: Recipe[] }>("/api/kitchen");
  const keeper = useJson<{ questions: Question[] }>("/api/keeper");
  const [, tick] = useState(0);
  // Everything here depends on "now" in several zones: render after mount so
  // server and browser never disagree, then refresh each minute.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!mounted) {
    return (
      <div>
        <RoomHeader title="Sit together" subtitle="Not a meeting. A reason to be in the same room." />
        <div className="skeleton h-[220px] rounded-card" aria-busy="true" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div>
      <RoomHeader title="Sit together" subtitle="Not a meeting. A reason to be in the same room." />
      <Knocks knocks={data?.knocks ?? null} members={members} viewer={viewer} onChange={reload} />
      <AwakeStrip members={members} viewer={viewer} />
      <Plan members={members} viewer={viewer} recipes={kitchen.data?.recipes ?? []} questions={keeper.data?.questions ?? []} onPlanned={reload} />
      <Upcoming sittings={data?.sittings ?? null} members={members} viewer={viewer} onChange={reload} />
    </div>
  );
}

/* --------------------------------------------------- come sit with me */
function Knocks({ knocks, members, viewer, onChange }: { knocks: Knock[] | null; members: Member[]; viewer: Member; onChange: () => void }) {
  const [minutes, setMinutes] = useState(45);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = knocks?.find((k) => k.memberId === viewer.id);
  const others = (knocks ?? []).filter((k) => k.memberId !== viewer.id);
  return (
    <section aria-label="Come sit with me">
      {others.map((k) => {
        const who = members.find((m) => m.id === k.memberId);
        return (
          <div key={k.id} className="mb-3 flex items-center gap-3 rounded-card bg-[#fff6e6] p-4">
            <Avatar src={memberPhoto(who)} name={callName(who)} size={52} ring />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[16px] font-semibold">{callName(who)} is in the courtyard</p>
              <p className="voice m-0 text-[16px] text-[#8a4b00]">{k.note || "Come sit with me?"}</p>
              <p className="m-0 text-[12px] text-ink-faint">until {fmt(viewer.tz, k.until, { hour: "numeric", minute: "2-digit" })} your time</p>
            </div>
            <a href={roomUrl(k.id)} target="_blank" rel="noreferrer" className="press flex h-11 shrink-0 items-center rounded-full bg-black px-4 text-[14px] font-semibold text-white no-underline">
              Come sit
            </a>
          </div>
        );
      })}

      <div className="rounded-card bg-surface p-5">
        {mine ? (
          <>
            <p className="m-0 text-[17px] font-semibold">Your door is open</p>
            <p className="m-0 mt-1 text-[15px] text-ink-soft">
              The family sees &ldquo;{mine.note || "Come sit with me?"}&rdquo; until {fmt(viewer.tz, mine.until, { hour: "numeric", minute: "2-digit" })}.
            </p>
            <div className="mt-3 flex gap-2">
              <a href={roomUrl(mine.id)} target="_blank" rel="noreferrer" className="press flex h-[52px] flex-[1.4] items-center justify-center rounded-full bg-black text-[16px] font-semibold text-white no-underline">
                Go sit
              </a>
              <Button variant="secondary" className="flex-1 !bg-white" onClick={async () => { await postJson("/api/sit", { action: "unknock" }); onChange(); }}>
                Close the door
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="m-0 flex items-center gap-2 text-[17px] font-semibold">
              <Icon name="door" size={20} />
              I&rsquo;m free now, come sit
            </p>
            <p className="m-0 mt-1 text-[15px] text-ink-soft">Like leaving the courtyard door open. Whoever is free drops in. No scheduling.</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Chai on the verandah. Come sit?" className="mt-3 h-[52px] w-full rounded-full bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold" />
            <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="For how long">
              {[30, 45, 90].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={cn("press h-10 flex-1 rounded-full text-[14px] font-semibold", minutes === m ? "bg-black text-white" : "bg-white")}>
                  {m} min
                </button>
              ))}
            </div>
            <Button className="mt-3 w-full" disabled={busy} onClick={async () => { setBusy(true); await postJson("/api/sit", { action: "knock", minutes, note: note.trim() }); setBusy(false); setNote(""); onChange(); }}>
              Open my door
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------- when is everyone up */
function AwakeStrip({ members, viewer }: { members: Member[]; viewer: Member }) {
  const people = members.filter((m) => m.tz && m.tz !== "UTC");
  const now = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000 + i * 3_600_000));
  const windows = useMemo(() => awakeWindows(Array.from(new Set(people.map((p) => p.tz))), now, 24), [people.map((p) => p.tz).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = windows.find((w) => w.end.getTime() - w.start.getTime() >= 60 * 60_000) ?? windows[0];
  return (
    <section aria-label="When everyone is awake">
      <SectionTitle>Right now, around the family</SectionTitle>
      <ul className="m-0 list-none space-y-2.5 p-0">
        {people.map((p) => {
          const awakeNow = isAwake(p.tz, now);
          return (
            <li key={p.id} className="flex items-center gap-3">
              <Avatar src={memberPhoto(p)} name={callName(p)} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">{p.id === viewer.id ? "You" : callName(p)}</span>
                  <span className="tnum text-[13px] text-ink-soft">
                    {timeIn(p.tz)} · {placeFromTz(p.tz)} {awakeNow ? "" : "· asleep"}
                  </span>
                </div>
                <div className="mt-1 flex h-2 gap-[2px]" aria-hidden="true">
                  {hours.map((h) => (
                    <span key={h.getTime()} className={cn("flex-1 rounded-full", isAwake(p.tz, h) ? "bg-marigold" : "bg-black/[.07]")} />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-between pl-12 text-[11px] text-ink-faint" aria-hidden="true">
        <span>now</span>
        <span>+6h</span>
        <span>+12h</span>
        <span>+18h</span>
        <span>+24h</span>
      </div>
      <p className="m-0 mt-3 rounded-[16px] bg-surface px-4 py-3 text-[14px]">
        {best ? (
          <>
            Everyone&rsquo;s awake <span className="font-semibold">{fmt(viewer.tz, best.start, { weekday: "short", hour: "numeric", minute: "2-digit" })} – {fmt(viewer.tz, best.end, { hour: "numeric", minute: "2-digit" })}</span> your time
            {people.filter((p) => p.tz !== viewer.tz).slice(0, 2).map((p) => ` · ${fmt(p.tz, best.start, { hour: "numeric", minute: "2-digit" })} for ${callName(p)}`)}
          </>
        ) : (
          "No hour in the next day when everyone is awake. Leave a voice note instead, or open your door when you're free."
        )}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------- plan */
function Plan({ members, viewer, recipes, questions, onPlanned }: { members: Member[]; viewer: Member; recipes: Recipe[]; questions: Question[]; onPlanned: () => void }) {
  const others = members.filter((m) => m.id !== viewer.id);
  const elder = members.find((m) => m.role === "elder");
  const [reason, setReason] = useState<Reason | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [invites, setInvites] = useState<string[]>(others.map((m) => m.id));
  const [when, setWhen] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Deep link from a recipe: /gather?reason=cook&recipe=<id>
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("reason");
    if (r && REASONS.some((x) => x.id === r)) setReason(r as Reason);
    if (q.get("recipe")) setRecipeId(q.get("recipe"));
  }, []);
  const zones = Array.from(new Set([viewer.tz, ...members.filter((m) => invites.includes(m.id)).map((m) => m.tz)].filter((z) => z && z !== "UTC")));
  const slots = useMemo(() => suggestTimes(zones), [zones.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const recipe = recipes.find((r) => r.id === recipeId) ?? (reason === "cook" ? recipes[0] : undefined);
  const story = questions.find((q) => q.toMemberId === elder?.id && !q.answeredCardId);
  const meta = REASONS.find((r) => r.id === reason);
  const startsAt = when ?? (custom ? new Date(custom).toISOString() : null);

  if (done) {
    return (
      <section className="mt-8 rounded-card bg-[#fff6e6] p-5" role="status">
        <p className="m-0 text-[17px] font-semibold">It&rsquo;s set. Everyone will see it in their own time.</p>
        <button type="button" className="mt-2 h-10 text-[15px] font-semibold" onClick={() => { setDone(false); setReason(null); setWhen(null); }}>
          Plan another
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Plan a sitting">
      <SectionTitle>Plan a reason to sit together</SectionTitle>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
        {REASONS.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} onClick={() => setReason(r.id)} className={cn("press h-10 rounded-full px-4 text-[15px] font-medium", reason === r.id ? "bg-black text-white" : "bg-surface")}>
            {r.label}
          </button>
        ))}
      </div>

      {meta && (
        <div className="mt-4 space-y-4 rounded-card bg-surface p-5">
          <div>
            <p className="m-0 text-[20px] font-semibold">{meta.title({ elder: elder ? callName(elder) : undefined, recipe: recipe?.title })}</p>
            <p className="m-0 mt-1 text-[15px] text-ink-soft">{meta.hint}</p>
            {reason === "story" && story && <p className="voice m-0 mt-2 text-[17px]">Tonight&rsquo;s question: &ldquo;{story.text}&rdquo;</p>}
          </div>

          {reason === "cook" && recipes.length > 0 && (
            <div>
              <p className="m-0 mb-1.5 text-[13px] font-medium text-ink-soft">Which recipe</p>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {recipes.map((r) => (
                  <button key={r.id} type="button" onClick={() => setRecipeId(r.id)} aria-pressed={recipe?.id === r.id} className={cn("press h-10 shrink-0 rounded-full px-4 text-[14px] font-medium", recipe?.id === r.id ? "bg-black text-white" : "bg-white")}>
                    {r.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="m-0 mb-1.5 text-[13px] font-medium text-ink-soft">Who</p>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {others.map((m) => {
                const on = invites.includes(m.id);
                return (
                  <button key={m.id} type="button" aria-pressed={on} onClick={() => setInvites((v) => (on ? v.filter((x) => x !== m.id) : [...v, m.id]))} className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", on ? "bg-black text-white" : "bg-white")}>
                    <Avatar src={memberPhoto(m)} name={callName(m)} size={34} />
                    {callName(m)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="m-0 mb-1.5 text-[13px] font-medium text-ink-soft">When everyone is awake</p>
            {slots.length === 0 && <p className="m-0 text-[14px] text-ink-soft">No shared waking hour soon. Pick a time below.</p>}
            <div className="space-y-2">
              {slots.map((s) => {
                const iso = s.toISOString();
                const on = when === iso;
                return (
                  <button key={iso} type="button" aria-pressed={on} onClick={() => { setWhen(iso); setCustom(""); }} className={cn("press block w-full rounded-[18px] px-4 py-3 text-left", on ? "bg-black text-white" : "bg-white")}>
                    <span className="block text-[16px] font-semibold">{fmt(viewer.tz, s, { weekday: "long", hour: "numeric", minute: "2-digit" })} your time</span>
                    <span className={cn("block text-[13px]", on ? "text-white/70" : "text-ink-soft")}>
                      {members
                        .filter((m) => invites.includes(m.id) && m.tz !== viewer.tz)
                        .map((m) => `${callName(m)} ${fmt(m.tz, s, { weekday: "short", hour: "numeric", minute: "2-digit" })}`)
                        .join(" · ") || "Same time for everyone"}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="mt-2 block">
              <span className="sr-only">Pick another time</span>
              <input type="datetime-local" value={custom} onChange={(e) => { setCustom(e.target.value); setWhen(null); }} className="h-[52px] w-full rounded-full bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold" />
            </label>
            {custom && (
              <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[13px]">
                {members
                  .filter((m) => invites.includes(m.id) || m.id === viewer.id)
                  .map((m) => {
                    const d = new Date(custom);
                    const h = hourIn(m.tz, d);
                    const late = h < 7 || h >= 22;
                    return (
                      <li key={m.id} className={cn(late ? "text-[#b42318]" : "text-ink-soft")}>
                        {m.id === viewer.id ? "You" : callName(m)}: {fmt(m.tz, d, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                        {late ? " · they'll be asleep" : ""}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          <Button
            className="w-full"
            disabled={busy || !startsAt}
            onClick={async () => {
              if (!startsAt || !reason) return;
              setBusy(true);
              const out = await postJson("/api/sit", {
                action: "sit",
                reason,
                title: meta.title({ elder: elder ? callName(elder) : undefined, recipe: recipe?.title }),
                startsAt,
                invites,
                recipeId: reason === "cook" ? (recipe?.id ?? null) : null,
                note: reason === "story" && story ? story.text : "",
              });
              setBusy(false);
              if (out) {
                setDone(true);
                onPlanned();
              }
            }}
          >
            {busy ? "Setting it up…" : "Set it up"}
          </Button>
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------- upcoming */
function Upcoming({ sittings, members, viewer, onChange }: { sittings: Sitting[] | null; members: Member[]; viewer: Member; onChange: () => void }) {
  const [moving, setMoving] = useState<string | null>(null);
  const [newTime, setNewTime] = useState("");
  if (sittings === null) return <div className="skeleton mt-8 h-24 rounded-card" aria-busy="true" />;
  return (
    <section aria-label="Coming up">
      <SectionTitle>Coming up</SectionTitle>
      {sittings.length === 0 && <EmptyLine>Nothing planned yet. Pick a reason above.</EmptyLine>}
      <ul className="m-0 list-none space-y-3 p-0">
        {sittings.map((s) => {
          const start = new Date(s.startsAt);
          const minsTo = (start.getTime() - Date.now()) / 60_000;
          const live = minsTo <= 15 && minsTo > -120;
          const people = [s.hostId, ...s.invites].map((id) => members.find((m) => m.id === id)).filter((m): m is Member => Boolean(m));
          const host = members.find((m) => m.id === s.hostId);
          return (
            <li key={s.id} className="rounded-card bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-[17px] font-semibold">{s.title}</p>
                  <p className="m-0 mt-0.5 text-[13px] text-ink-soft">{s.hostId === viewer.id ? "You set this up" : `Set up by ${callName(host)}`}</p>
                </div>
                {live && <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-white">Now</span>}
              </div>
              {s.note && <p className="voice m-0 mt-2 text-[16px]">“{s.note}”</p>}
              <ul className="m-0 mt-3 list-none divide-y divide-[var(--line)] rounded-[16px] bg-white p-0 px-3">
                {people.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-[14px] font-medium">
                      <Avatar src={memberPhoto(m)} name={callName(m)} size={26} />
                      {m.id === viewer.id ? "You" : callName(m)}
                    </span>
                    <span className="tnum text-right text-[13px] text-ink-soft">
                      {fmt(m.tz, start, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {m.id !== s.hostId && (s.going.includes(m.id) ? <span className="ml-1.5 font-semibold text-[#1e6b3a]">· coming</span> : s.cantMake.includes(m.id) ? <span className="ml-1.5 font-semibold text-[#b42318]">· can&rsquo;t</span> : null)}
                    </span>
                  </li>
                ))}
              </ul>
              {s.hostId !== viewer.id && s.invites.includes(viewer.id) && (
                <div className="mt-3 flex gap-2" role="group" aria-label="Will you be there?">
                  {(["going", "cant"] as const).map((a) => {
                    const on = a === "going" ? s.going.includes(viewer.id) : s.cantMake.includes(viewer.id);
                    return (
                      <button key={a} type="button" aria-pressed={on} onClick={async () => { await postJson("/api/sit", { action: "rsvp", sittingId: s.id, answer: on ? "clear" : a }); onChange(); }} className={cn("press h-10 flex-1 rounded-full text-[14px] font-semibold", on ? "bg-black text-white" : "bg-white")}>
                        {a === "going" ? "I'll be there" : "Can't make it"}
                      </button>
                    );
                  })}
                </div>
              )}
              {s.hostId === viewer.id && moving === s.id && (
                <div className="mt-3 flex gap-2">
                  <input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="New time" className="h-10 flex-1 rounded-full bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-marigold" />
                  <button type="button" disabled={!newTime} className="press h-10 rounded-full bg-black px-4 text-[14px] font-semibold text-white disabled:opacity-40" onClick={async () => { await postJson("/api/sit", { action: "reschedule", sittingId: s.id, startsAt: new Date(newTime).toISOString() }); setMoving(null); setNewTime(""); onChange(); }}>
                    Move
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={roomUrl(s.id)} target="_blank" rel="noreferrer" className={cn("press flex h-10 items-center rounded-full px-4 text-[14px] font-semibold no-underline", live ? "bg-black text-white" : "bg-white text-ink")}>
                  {live ? "Join now" : "Room link"}
                </a>
                <button
                  type="button"
                  className="press h-10 rounded-full bg-white px-4 text-[14px] font-semibold"
                  onClick={() => {
                    const blob = new Blob([icsFor({ id: s.id, title: s.title, start, description: s.note, url: roomUrl(s.id) })], { type: "text/calendar" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${s.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
                  }}
                >
                  Add to calendar
                </button>
                {s.recipeId && (
                  <Link href={`/kitchen/${s.recipeId}`} className="press flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-ink no-underline">
                    Open the recipe
                  </Link>
                )}
                {s.hostId === viewer.id && (
                  <>
                    <button type="button" className="h-10 px-2 text-[14px] font-medium text-ink-soft" onClick={() => setMoving(moving === s.id ? null : s.id)}>
                      Change time
                    </button>
                    <button type="button" className="h-10 px-2 text-[14px] font-medium text-ink-faint" onClick={async () => { await postJson("/api/sit", { action: "cancel", sittingId: s.id }); onChange(); }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-4 text-[12px] text-ink-faint">Rooms open in your browser (Jitsi Meet). No account, and only people with the link can join.</p>
    </section>
  );
}
