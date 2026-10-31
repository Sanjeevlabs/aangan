"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Carousel } from "@/components/carousel";
import { EventHero, EventMini } from "@/components/event-card";
import { PlanSheet, type PlanPreset } from "@/components/event-plan-sheet";
import { EventPrompts } from "@/components/event-prompts";
import Link from "next/link";
import { WishAhead } from "@/components/wish-ahead";
import { Avatar, Button, EmptyState, Icon, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { fmtIn, occasionEventKey } from "@/lib/events";
import { nextEvent, useEvents } from "@/lib/gather-client";
import type { UpcomingOccasion } from "@/lib/gather-prompts";
import type { Knock, Recipe } from "@/lib/kinds";
import { roomUrl } from "@/lib/overlap";
import { callName, memberPhoto } from "@/lib/people";
import type { Member } from "@/lib/schemas";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";

export default function GatherPage() {
  const { viewer, members } = useViewer();
  const router = useRouter();
  const { data, failed, reload } = useEvents();
  const [sheet, setSheet] = useState<PlanPreset | null>(null);
  // Render times after mount so server and browser never disagree on "now".
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => void reload(), 60_000);
    return () => clearInterval(t);
  }, [reload]);

  // Deep links: /gather?plan=1, and from a recipe /gather?reason=cook&recipe=<id>.
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const kitchen = useJson<{ recipes: Recipe[] }>(recipeId ? "/api/kitchen" : null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("reason") === "cook" && q.get("recipe")) setRecipeId(q.get("recipe"));
    else if (q.get("plan")) setSheet({});
  }, []);
  useEffect(() => {
    const r = kitchen.data?.recipes.find((x) => x.id === recipeId);
    if (r) setSheet({ type: "custom", title: `Cook ${r.title} together`.slice(0, 80) });
  }, [kitchen.data, recipeId]);

  const canPlan = data?.canPlan ?? viewer.role !== "child";
  const plus = canPlan ? (
    <button type="button" onClick={() => setSheet({})} aria-label="Plan an event" className="press grid h-11 w-11 place-items-center rounded-full bg-[#1c1b1a] text-white">
      <Icon name="plus" />
    </button>
  ) : undefined;

  if (!mounted || (!data && !failed)) {
    return (
      <div>
        <RoomHeader title="Coming up" action={plus} />
        <div className="skeleton h-[230px] rounded-[28px]" aria-busy="true" aria-label="Loading" />
        <div className="skeleton mt-3 h-16 rounded-[22px]" />
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <RoomHeader title="Coming up" />
        <div className="rounded-[28px] bg-card p-5 shadow-card" role="alert">
          <p className="m-0 text-[17px] font-semibold">Couldn&rsquo;t load your celebrations.</p>
          <Button variant="secondary" className="mt-3 !bg-well" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const next = nextEvent(data.events);
  const rest = data.events.filter((e) => e.id !== next?.id);
  // Occasions not planned yet (the one the prompt above already offers is left out).
  const planned = new Set(data.events.filter((e) => e.status !== "cancelled").map((e) => occasionEventKey(e.occasionKey, e.date, e.forMemberId)));
  const prompted = new Set(data.prompts.flatMap((p) => (p.kind === "suggest" ? [p.occasion.key] : [])));
  const upcoming = data.occasions
    .filter((o) => o.days >= 0 && (o.kind !== "national" || o.days <= 30) && !planned.has(o.key) && !prompted.has(o.key))
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);
  return (
    <div>
      <RoomHeader title="Coming up" subtitle="Birthdays and festivals ahead, and the celebrations you planned." action={plus} />
      <WishAhead viewer={viewer} />
      <EventPrompts prompts={data.prompts.filter((p) => p.kind !== "pick" || p.eventId !== next?.id)} onChange={() => void reload()} className="mb-4" />

      {next ? (
        <EventHero e={next} members={members} viewer={viewer} />
      ) : (
        <EmptyState
          position="center 45%"
          title="Nothing planned yet."
          line="A birthday, a festival, a visit home."
          action={
            canPlan ? (
              <Button className="w-full" onClick={() => setSheet({})}>
                <Icon name="plus" size={18} />
                Plan an event
              </Button>
            ) : undefined
          }
        />
      )}

      {rest.length > 0 && (
        <>
          <SectionTitle>Also coming up</SectionTitle>
          <Carousel label="Also coming up" slide="72%">
            {rest.map((e) => (
              <EventMini key={e.id} e={e} members={members} viewer={viewer} />
            ))}
          </Carousel>
        </>
      )}

      <ComingUp occasions={upcoming} members={members} viewerId={viewer.id} canPlan={canPlan} onPlan={(o) => setSheet({ occasion: o })} />

      <Knocks members={members} viewer={viewer} />

      <PlanSheet
        open={sheet !== null}
        preset={sheet ?? undefined}
        onClose={() => setSheet(null)}
        occasions={data.occasions}
        members={members}
        viewer={viewer}
        onCreated={(e) => {
          setSheet(null);
          router.push(`/gather/${e.id}`);
        }}
      />
    </div>
  );
}

/* ------------------------------------------- occasions not planned yet */
function ComingUp({ occasions, members, viewerId, canPlan, onPlan }: { occasions: UpcomingOccasion[]; members: Member[]; viewerId: string; canPlan: boolean; onPlan: (o: UpcomingOccasion) => void }) {
  if (!occasions.length) return null;
  return (
    <section aria-label="Birthdays and festivals ahead">
      <SectionTitle>Birthdays and festivals ahead</SectionTitle>
      <ul className="m-0 list-none divide-y divide-[var(--line)] overflow-hidden rounded-card bg-card p-0 shadow-card">
        {occasions.map((o) => {
          const d = new Date(`${o.date}T12:00:00Z`);
          const who = o.memberId ? members.find((m) => m.id === o.memberId) : undefined;
          // A small second action on a person's day: send them something (Plan stays the main one).
          const sendable = who && who.id !== viewerId && (o.kind === "birthday" || o.type === "anniversary");
          return (
            <li key={o.key} className="flex items-center gap-3 p-3 pl-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-well text-center leading-none" aria-hidden="true">
                <span>
                  <span className="tnum block text-[18px] font-bold">{d.getUTCDate()}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-soft">{d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold leading-tight">{o.label}</span>
                <span className="mt-0.5 block text-[14px] text-ink-soft">{o.days === 0 ? "Today" : `In ${o.days} day${o.days > 1 ? "s" : ""}`}</span>
              </span>
              {who && <Avatar src={memberPhoto(who)} name={callName(who)} size={32} />}
              {sendable && (
                <Link href={`/send?for=${encodeURIComponent(who.id)}&kind=occasion&title=${encodeURIComponent(o.label)}`} aria-label={`Send something for ${o.label}`} title="Send something" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-well text-ink no-underline">
                  <Icon name="gift" size={18} />
                </Link>
              )}
              {canPlan && (
                <button type="button" onClick={() => onPlan(o)} aria-label={`Plan ${o.label}`} className="press h-11 shrink-0 rounded-full bg-[#1c1b1a] px-4 text-[15px] font-semibold text-white">
                  Plan
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------------------- come sit with me (no plan) */
function Knocks({ members, viewer }: { members: Member[]; viewer: Member }) {
  const { data, reload } = useJson<{ knocks: Knock[] }>("/api/sit");
  const [busy, setBusy] = useState(false);
  const [minutes, setMinutes] = useState(45);
  const knocks = data?.knocks ?? [];
  const mine = knocks.find((k) => k.memberId === viewer.id);
  const others = knocks.filter((k) => k.memberId !== viewer.id);
  return (
    <section aria-label="Come sit with me">
      <SectionTitle>Or just sit, now</SectionTitle>
      {others.map((k) => {
        const who = members.find((m) => m.id === k.memberId);
        return (
          <div key={k.id} className="mb-3 flex items-center gap-3 rounded-[22px] bg-card p-3 shadow-card">
            <Avatar src={memberPhoto(who)} name={callName(who)} size={44} ring />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[15px] font-semibold">{callName(who)}&rsquo;s door is open</p>
              <p className="voice m-0 truncate text-[15px] text-ink-soft">{k.note || "Come sit with me?"}</p>
            </div>
            <a href={roomUrl(k.id)} target="_blank" rel="noreferrer" aria-label={`Sit with ${callName(who)}`} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1c1b1a] text-white no-underline">
              <Icon name="video" size={20} />
            </a>
          </div>
        );
      })}
      <div className="flex items-center gap-2 rounded-[22px] bg-card p-2 shadow-card">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-well">
          <Icon name={mine ? "door" : "doorClosed"} size={20} />
        </span>
        <p className="m-0 min-w-0 flex-1 text-[15px] font-semibold">{mine ? `Door open till ${fmtIn(viewer.tz, mine.until, { hour: "numeric", minute: "2-digit" })}` : "I'm free, come sit"}</p>
        {mine ? (
          <>
            <a href={roomUrl(mine.id)} target="_blank" rel="noreferrer" aria-label="Go sit" className="press grid h-11 w-11 place-items-center rounded-full bg-[#1c1b1a] text-white no-underline">
              <Icon name="video" size={20} />
            </a>
            <button type="button" aria-label="Close the door" disabled={busy} onClick={async () => { setBusy(true); await postJson("/api/sit", { action: "unknock" }); setBusy(false); void reload(); }} className="press grid h-11 w-11 place-items-center rounded-full bg-well">
              <Icon name="close" size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-1" role="radiogroup" aria-label="For how long">
              {[30, 45, 90].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={cn("press tnum h-11 rounded-full px-2.5 text-[14px] font-semibold", minutes === m ? "bg-well" : "text-ink-soft")}>
                  {m}′
                </button>
              ))}
            </div>
            <button type="button" aria-label="Open my door" disabled={busy} onClick={async () => { setBusy(true); await postJson("/api/sit", { action: "knock", minutes, note: "" }); setBusy(false); void reload(); }} className="press grid h-11 w-11 place-items-center rounded-full bg-[#1c1b1a] text-white">
              <Icon name="door" size={20} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
