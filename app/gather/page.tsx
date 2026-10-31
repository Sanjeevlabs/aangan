"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Carousel } from "@/components/carousel";
import { EventHero, EventMini } from "@/components/event-card";
import { PlanSheet, type PlanPreset } from "@/components/event-plan-sheet";
import { EventPrompts } from "@/components/event-prompts";
import { Avatar, Button, Icon, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { fmtIn } from "@/lib/events";
import { nextEvent, useEvents } from "@/lib/gather-client";
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
        <RoomHeader title="Gathering" action={plus} />
        <div className="skeleton h-[230px] rounded-[28px]" aria-busy="true" aria-label="Loading" />
        <div className="skeleton mt-3 h-16 rounded-[22px]" />
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <RoomHeader title="Gathering" />
        <div className="rounded-[28px] bg-black/[.04] p-5" role="alert">
          <p className="m-0 text-[17px] font-semibold">Couldn&rsquo;t load your gatherings.</p>
          <Button variant="secondary" className="mt-3 !bg-white" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const next = nextEvent(data.events);
  const rest = data.events.filter((e) => e.id !== next?.id);
  return (
    <div>
      <RoomHeader title="Gathering" subtitle="Plan a family video call with a reason." action={plus} />
      <EventPrompts prompts={data.prompts.filter((p) => p.kind !== "pick" || p.eventId !== next?.id)} onChange={() => void reload()} className="mb-4" />

      {next ? (
        <EventHero e={next} members={members} viewer={viewer} />
      ) : (
        <div className="rounded-[28px] p-6 text-white" style={{ background: "#1c1b1a" }}>
          <p className="voice m-0 text-[22px] leading-snug">Nothing planned yet.</p>
          <p className="m-0 mt-1 text-[14px] text-white/60">A birthday, a festival, a visit home.</p>
          {canPlan && (
            <button type="button" onClick={() => setSheet({})} className="press mt-5 flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-[#1c1b1a]">
              <Icon name="plus" size={18} />
              Plan an event
            </button>
          )}
        </div>
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
          <div key={k.id} className="mb-2 flex items-center gap-3 rounded-[22px] bg-black/[.04] p-3">
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
      <div className="flex items-center gap-2 rounded-[22px] bg-black/[.04] p-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white">
          <Icon name={mine ? "door" : "doorClosed"} size={20} />
        </span>
        <p className="m-0 min-w-0 flex-1 text-[15px] font-semibold">{mine ? `Door open till ${fmtIn(viewer.tz, mine.until, { hour: "numeric", minute: "2-digit" })}` : "I'm free, come sit"}</p>
        {mine ? (
          <>
            <a href={roomUrl(mine.id)} target="_blank" rel="noreferrer" aria-label="Go sit" className="press grid h-11 w-11 place-items-center rounded-full bg-[#1c1b1a] text-white no-underline">
              <Icon name="video" size={20} />
            </a>
            <button type="button" aria-label="Close the door" disabled={busy} onClick={async () => { setBusy(true); await postJson("/api/sit", { action: "unknock" }); setBusy(false); void reload(); }} className="press grid h-11 w-11 place-items-center rounded-full bg-white">
              <Icon name="close" size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-1" role="radiogroup" aria-label="For how long">
              {[30, 45, 90].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={cn("press tnum h-9 rounded-full px-2.5 text-[13px] font-semibold", minutes === m ? "bg-white" : "text-ink-soft")}>
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
