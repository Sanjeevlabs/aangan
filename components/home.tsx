"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { daysUntilBirthday } from "@/lib/family";
import { greetingForHour } from "@/lib/i18n";
import { callName, cardCover, memberPhoto, peopleByRecency, relativeDay, tintShadow } from "@/lib/people";
import type { Card, Member } from "@/lib/schemas";
import { useDisplayText } from "@/lib/use-display-text";
import { useFamilyCards } from "@/lib/use-family";
import { CourtyardNow, ShareYourDay } from "./home-presence";
import { VoicePlaque } from "./plaque";
import { SideSwitch } from "./sides";
import { HeardChip } from "./reactions";
import { usePlayer } from "./player";
import { useShell } from "./shell";
import { Avatar, Icon, Monogram, Photo, SectionTitle } from "./ui/kit";
import { useViewer } from "./viewer";

/* Ask the parents for what only they can give. */
function AskStrip() {
  const { viewer, members } = useViewer();
  const elders = members.filter((m) => m.role === "elder" && m.id !== viewer.id);
  if (viewer.role === "elder" || elders.length === 0) return null;
  const names = elders.slice(0, 2).map((m) => callName(m)).join(" & ");
  return (
    <section aria-label={`Ask ${names}`}>
      <SectionTitle href="/ask" linkLabel="Ask">
        Ask {names}
      </SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {(["A recipe", "A story", "Advice", "A blessing"] as const).map((label) => (
          <Link key={label} href="/ask" className="press flex h-[72px] items-end rounded-[20px] bg-surface p-3 text-[14px] font-semibold leading-tight text-ink no-underline">
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* One album per person: the people are the artists. */
function PersonAlbum({ member, latest }: { member: Member; latest: Card | undefined }) {
  const { play } = usePlayer();
  const photo = memberPhoto(member);
  return (
    <li className="relative w-[148px] shrink-0" style={{ scrollSnapAlign: "start" }}>
      <Link href={`/people/${member.id}`} className="block text-ink no-underline">
        <div className="relative h-[148px] overflow-hidden rounded-cover bg-surface" style={{ boxShadow: tintShadow(latest ?? null, 0.35) }}>
          {photo ? <Photo src={photo} alt={callName(member)} sizes="300px" position="center 30%" /> : <Monogram name={callName(member)} size={148} />}
        </div>
        <p className="m-0 mt-2.5 text-[15px] font-semibold">{callName(member)}</p>
        <p className="m-0 text-[13px] text-ink-soft">{latest ? `${latest.type === "audio" ? "Voice" : "Photo"} · ${relativeDay(latest.takenAt)}` : "Nothing yet"}</p>
      </Link>
      {latest?.type === "audio" && (
        <button
          type="button"
          onClick={() => play(latest)}
          aria-label={`Play ${callName(member)}'s latest voice note`}
          className="glass press absolute left-[104px] top-[104px] grid h-9 w-9 place-items-center rounded-full"
        >
          <Icon name="play" size={14} />
        </button>
      )}
    </li>
  );
}

function OccasionCard({ member, days }: { member: Member; days: number }) {
  const { openAdd } = useShell();
  const photo = memberPhoto(member) ?? "/demo/family-group.webp";
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return (
    <article className="relative h-[200px] overflow-hidden rounded-card bg-surface" style={{ boxShadow: "0 22px 44px -20px rgba(90,50,20,.5)" }}>
      <Photo src={photo} alt="" sizes="440px" position="center 35%" />
      <div className="glass absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-3 rounded-[18px] py-3 pl-4 pr-3">
        <div className="min-w-0">
          <p className="m-0 text-[17px] font-semibold">{callName(member)}'s birthday</p>
          <p className="m-0 text-[13px] text-white/85">{when} · record a wish before the day</p>
        </div>
        <button
          type="button"
          onClick={() => openAdd("voice", null, member.id)}
          className="press h-10 shrink-0 rounded-full bg-white px-4 text-[14px] font-semibold text-black"
        >
          Add yours
        </button>
      </div>
    </article>
  );
}

function YearsAgo({ card }: { card: Card }) {
  const { members, displayLang } = useViewer();
  const { text } = useDisplayText(card.caption, card.lang, displayLang);
  const year = new Date(card.takenAt).getFullYear();
  return (
    <Link href="/lane" className="block text-white no-underline">
      <article className="relative h-[260px] overflow-hidden rounded-card bg-surface" style={{ boxShadow: tintShadow(card, 0.45) }}>
        <Photo src={cardCover(card, members)} alt={text ?? ""} sizes="440px" />
        <div className="glass absolute inset-x-2.5 bottom-2.5 rounded-[18px] px-4 py-3">
          <p className="m-0 text-[13px] text-white/85">{new Date().getFullYear() - year} years ago today</p>
          <p className="m-0 text-[17px] font-semibold">{text ?? "…"}</p>
        </div>
      </article>
    </Link>
  );
}

export function Home() {
  const { viewer, members } = useViewer();
  const { refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const [hour] = useState(() => new Date().getHours());

  const others = useMemo(() => (cards ?? []).filter((c) => c.authorId && c.authorId !== viewer.id), [cards, viewer.id]);
  const hero = others.find((c) => c.type === "audio");
  const heroAuthor = members.find((m) => m.id === hero?.authorId);
  const people = useMemo(() => peopleByRecency(viewer.id, members, cards ?? []), [viewer.id, members, cards]);
  const latestBy = (id: string) => (cards ?? []).find((c) => c.authorId === id);
  // Only the parents' birthdays, and only when it's close: a wish is an ask too.
  const next = members
    .filter((m) => m.id !== viewer.id && m.role === "elder")
    .map((member) => ({ member, days: daysUntilBirthday(member.birthday) }))
    .filter((o) => Number.isFinite(o.days) && o.days <= 30)
    .sort((a, b) => a.days - b.days)[0];
  const thisYear = new Date().getFullYear();
  const yearsAgo = (cards ?? []).find((c) => c.type === "photo" && new Date(c.takenAt).getFullYear() < thisYear);
  const part = greetingForHour(hour);

  return (
    <div>
      <header className="flex items-center justify-between pt-6">
        <div className="min-w-0">
          <h1 className="m-0 text-[30px] leading-[1.05]">{viewer.firstName}&rsquo;s Aangan</h1>
          <p className="m-0 mt-1 text-[15px] text-ink-soft">
            Good {part}
            {heroAuthor ? ` · ${callName(heroAuthor)} sent you something` : ""}
          </p>
          <SideSwitch />
        </div>
        <Link href="/settings" aria-label="Your account and settings" className="press rounded-full">
          <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={42} ring />
        </Link>
      </header>

      <CourtyardNow />

      {cards === null ? (
        <div className="skeleton mt-5 h-[560px] rounded-[30px]" aria-busy="true" aria-label="Loading" />
      ) : hero ? (
        <>
          <div className="mt-5">
            <VoicePlaque card={hero} priority />
          </div>
          <div className="mt-3 flex min-h-[20px] items-center gap-2 px-1 text-[13px] text-ink-soft [&_p]:text-[13px]">
            <HeardChip cardId={hero.id} />
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-hero bg-surface px-6 py-12 text-center">
          <p className="m-0 text-[20px] font-semibold">{people.length === 0 ? "Your courtyard is ready" : "The courtyard is quiet"}</p>
          <p className="m-0 mx-auto mt-2 max-w-[280px] text-[15px] text-ink-soft">
            {people.length === 0 ? "Invite the people you miss. When they speak, you'll hear them here first." : "Say hello first. A voice note is the warmest way to start."}
          </p>
          {people.length === 0 && (
            <div className="mx-auto mt-6 flex max-w-[280px] flex-col gap-2">
              <Link href="/settings#invite" className="press flex h-12 items-center justify-center rounded-full bg-black text-[15px] font-semibold text-white no-underline">
                Invite family
              </Link>
              <Link href="/settings" className="press flex h-12 items-center justify-center rounded-full bg-white text-[15px] font-semibold text-ink no-underline">
                Add your photo
              </Link>
            </div>
          )}
        </div>
      )}

      <ShareYourDay />
      <AskStrip />

      {people.length > 0 && (
        <section aria-label="Your family">
          <SectionTitle href="/bond" linkLabel="Family tree">
            Your family
          </SectionTitle>
          <ul className="no-scrollbar -mx-5 m-0 flex list-none gap-3 overflow-x-auto px-5 pb-2" style={{ scrollSnapType: "x mandatory", scrollPaddingInline: 20 }}>
            {people.map((m) => (
              <PersonAlbum key={m.id} member={m} latest={latestBy(m.id)} />
            ))}
          </ul>
        </section>
      )}

      {next && (
        <section aria-label="Coming up">
          <SectionTitle href="/rituals" linkLabel="Occasions">
            Coming up
          </SectionTitle>
          <OccasionCard member={next.member} days={next.days} />
        </section>
      )}

      {!next && yearsAgo && viewer.role !== "elder" && (
        <section aria-label="From the years">
          <SectionTitle href="/lane" linkLabel="Memory Lane">
            From the years
          </SectionTitle>
          <YearsAgo card={yearsAgo} />
        </section>
      )}
    </div>
  );
}
