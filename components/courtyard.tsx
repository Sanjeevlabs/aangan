"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { dailyRoleFor } from "@/lib/family";
import type { Knock, Sitting } from "@/lib/kinds";
import { roomsFor } from "@/lib/menu";
import { callName, cardCover, memberPhoto, peopleByRecency, relativeDay, tintShadow } from "@/lib/people";
import type { Card, Member } from "@/lib/schemas";
import { useDisplayText } from "@/lib/use-display-text";
import { useFamilyCards } from "@/lib/use-family";
import { ago, postJson, useJson } from "@/lib/use-json";
import { isAwake, placeFromTz, timeIn } from "@/lib/zones";
import { CourtyardNow } from "./home-presence";
import { usePlayer } from "./player";
import { VoiceCode } from "./plaque";
import { HeardChip } from "./reactions";
import { useShell } from "./shell";
import { SideSwitch } from "./sides";
import { TodayCard, useToday } from "./today";
import { Avatar, Icon, Monogram, Photo, SectionTitle, type IconName } from "./ui/kit";
import { useViewer } from "./viewer";

// Kutumb (SPEC §29.3): behind the door. One courtyard, five rooms, one
// live thing (Sit together) and one thing to do today. Clean on purpose.

/* ---------------------------------------------------------------- rooms */
function RoomTiles() {
  const router = useRouter();
  const { viewer } = useViewer();
  const { openRoom } = useShell();
  const rooms = roomsFor(viewer.role === "elder");
  return (
    <nav aria-label="Rooms" className="mt-5 grid grid-cols-5 gap-2">
      {rooms.map((r) => (
        <button key={r.id} type="button" onClick={() => (r.href ? router.push(r.href) : openRoom(r.id))} className="press flex flex-col items-center gap-1.5 text-center">
          <span
            className="grid aspect-square w-full max-w-[66px] place-items-center rounded-[20px]"
            style={{ background: `linear-gradient(150deg, ${r.tone[0]}, #ffffff 140%)`, color: r.tone[1], boxShadow: `0 12px 24px -18px ${r.tone[1]}, inset 0 1px 0 #fff` }}
          >
            <Icon name={r.icon as IconName} size={26} strokeWidth={1.9} />
          </span>
          <span className="text-[12.5px] font-semibold leading-tight text-ink">{r.title}</span>
        </button>
      ))}
    </nav>
  );
}

/* --------------------------------------------------------- sit together */
/** Live, not a room: who's awake right now in every home, and one tap to sit. */
function SitTogetherLive() {
  const router = useRouter();
  const { viewer, members } = useViewer();
  const sit = useJson<{ sittings: Sitting[]; knocks: Knock[] }>("/api/sit");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const adults = members.filter((m) => m.role !== "child");
  const awake = now ? adults.filter((m) => isAwake(m.tz, now)) : [];
  const knock = (sit.data?.knocks ?? [])[0];
  const host = members.find((m) => m.id === knock?.memberId);
  const next = (sit.data?.sittings ?? []).filter((s) => Date.parse(s.startsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  const start = async () => {
    if (knock) return router.push(`/call/${knock.id}`);
    setBusy(true);
    const out = await postJson<{ knock: Knock }>("/api/sit", { action: "knock", minutes: 45, note: "Come sit with me" });
    setBusy(false);
    if (out?.knock) router.push(`/call/${out.knock.id}`);
  };

  return (
    <section aria-label="Sit together" className="relative mt-5 overflow-hidden rounded-[28px] p-5 text-white" style={{ background: "linear-gradient(160deg,#0f2a22 0%,#123b2e 55%,#1b5140 100%)" }}>
      <div className="flex items-center justify-between">
        <p className="m-0 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/70">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7be3a6] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7be3a6]" />
          </span>
          {knock ? "Live now" : "Sit together"}
        </p>
        <Link href="/gather" className="text-[13px] font-semibold text-white/75 no-underline">
          Plan one
        </Link>
      </div>
      <p className="m-0 mt-2 text-[22px] font-bold leading-tight tracking-[-0.01em]">
        {knock ? `${host?.id === viewer.id ? "You are" : `${callName(host)} is`} on a video call` : awake.length > 1 ? `${awake.length} of you are awake now` : "Everyone's asleep somewhere"}
      </p>
      <p className="m-0 mt-1 text-[14px] text-white/70">{knock ? `Until ${now ? timeIn(viewer.tz, new Date(knock.until)) : ""} · join with video` : next ? `Next: ${next.title} · ${relativeDay(next.startsAt)}` : "Turn the camera on and leave it on. Like sitting in one room."}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <ul className="m-0 flex list-none -space-x-2.5 p-0" aria-label="Awake now">
          {(awake.length ? awake : adults).slice(0, 6).map((m) => (
            <li key={m.id} className="relative rounded-full ring-2 ring-[#123b2e]" title={`${callName(m)} · ${placeFromTz(m.tz)}`}>
              <Avatar src={memberPhoto(m)} name={callName(m)} size={38} />
              {awake.includes(m) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#7be3a6] ring-2 ring-[#123b2e]" />}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => void start()} disabled={busy} className="press flex h-12 shrink-0 items-center gap-2 rounded-full bg-white pl-4 pr-5 text-[15px] font-semibold text-[#123b2e]">
          <Icon name="video" size={19} />
          {knock ? "Join" : "Sit now"}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ a voice from home */
/** The music card: their photo as the cover, the voice as a waveform, Listen. */
function VoiceFromHome({ card }: { card: Card }) {
  const { members, displayLang } = useViewer();
  const { play, current, isPlaying, toggle } = usePlayer();
  const author = members.find((m) => m.id === card.authorId);
  const { text } = useDisplayText(card.transcript || card.caption, card.transcript ? card.transcriptLang : card.lang, displayLang);
  const playing = current?.id === card.id && isPlaying;
  return (
    <section aria-label="A voice from home" className="mt-5">
      <article className="relative overflow-hidden rounded-[30px]" style={{ boxShadow: tintShadow(card, 0.5) }}>
        <div className="relative aspect-[4/3.4] w-full">
          <Photo src={cardCover(card, members)} alt="" sizes="480px" position="center 30%" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" aria-hidden="true" />
        </div>
        <div className="absolute left-4 top-4">
          <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em]">
            <Icon name="music" size={13} /> A voice from home
          </span>
        </div>
        <div className="glass absolute inset-x-3 bottom-3 rounded-[22px] p-4">
          <p className="voice m-0 line-clamp-2 text-[19px] leading-snug">“{text ?? card.caption}”</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar src={memberPhoto(author)} name={callName(author)} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">{callName(author)}</span>
              <span className="block text-[12px] text-white/75">{relativeDay(card.takenAt)}</span>
            </span>
            <span className="hidden min-[400px]:block [&_span>span]:!bg-white/60">
              <VoiceCode peaks={card.peaks} bars={16} className="h-5" />
            </span>
            <button type="button" onClick={() => (current?.id === card.id ? toggle() : play(card))} className="press flex h-11 items-center gap-2 rounded-full bg-white pl-3 pr-4 text-[14px] font-semibold text-black">
              <Icon name={playing ? "pause" : "play"} size={15} />
              {playing ? "Pause" : "Listen"}
            </button>
          </div>
        </div>
      </article>
      <div className="mt-2 flex min-h-[20px] items-center gap-2 px-1 text-[13px] text-ink-soft [&_p]:text-[13px]">
        <HeardChip cardId={card.id} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------- today's role (parents) */
function TodaysRole() {
  const { displayLang } = useViewer();
  const { openAdd } = useShell();
  const role = dailyRoleFor(displayLang);
  return (
    <button type="button" onClick={() => openAdd("voice", { kind: "story", prompt: role.replace(/^[^:]+:\s*/, "") })} className="press mt-3 flex w-full items-center gap-3 rounded-[22px] bg-[#fff6e2] px-4 py-3.5 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marigold text-black">
        <Icon name="sun" size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a5a12]">Your role today</span>
        <span className="block text-[16px] font-semibold leading-snug text-ink">{role.replace(/^[^:]+:\s*/, "")}</span>
      </span>
      <Icon name="mic" size={20} className="text-[#8a5a12]" />
    </button>
  );
}

/* --------------------------------------------------------------- coming up */
function ComingUp() {
  const { members } = useViewer();
  const { openAdd } = useShell();
  const { data } = useToday();
  const occ = data?.occasion;
  if (!occ) return null;
  const who = members.find((m) => m.id === occ.memberId);
  const when = occ.days === 0 ? "today" : occ.days === 1 ? "tomorrow" : `in ${occ.days} days`;
  const photo = memberPhoto(who) ?? "/demo/family-group.webp";
  return (
    <section aria-label="Coming up">
      <SectionTitle href="/rituals" linkLabel="Occasions">
        Coming up
      </SectionTitle>
      <article className="relative h-[210px] overflow-hidden rounded-card bg-surface" style={{ boxShadow: "0 22px 44px -20px rgba(90,50,20,.5)" }}>
        <Photo src={photo} alt="" sizes="440px" position="center 35%" />
        <div className="glass absolute inset-x-2.5 bottom-2.5 rounded-[18px] p-3.5 pl-4">
          <p className="m-0 text-[17px] font-semibold">{occ.title}</p>
          <p className="m-0 text-[13px] text-white/85">{when} · both homes get asked for photos a week before</p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => openAdd("photos")} className="press flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-semibold text-black">
              <Icon name="camera" size={16} /> Add photos
            </button>
            {who && (
              <button type="button" onClick={() => openAdd("voice", null, who.id)} className="press flex h-10 items-center gap-1.5 rounded-full bg-white/20 px-4 text-[14px] font-semibold">
                <Icon name="mic" size={16} /> Record a wish
              </button>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

/* ------------------------------------------------------------ from the years */
function YearsAgo({ card }: { card: Card }) {
  const { members, displayLang } = useViewer();
  const { text } = useDisplayText(card.caption, card.lang, displayLang);
  const year = new Date(card.takenAt).getFullYear();
  return (
    <Link href="/lane" className="block text-white no-underline">
      <article className="relative h-[240px] overflow-hidden rounded-card bg-surface" style={{ boxShadow: tintShadow(card, 0.45) }}>
        <Photo src={cardCover(card, members)} alt={text ?? ""} sizes="440px" />
        <div className="glass absolute inset-x-2.5 bottom-2.5 rounded-[18px] px-4 py-3">
          <p className="m-0 text-[13px] text-white/85">{new Date().getFullYear() - year} years ago this season</p>
          <p className="m-0 text-[17px] font-semibold">{text ?? "…"}</p>
        </div>
      </article>
    </Link>
  );
}

/* --------------------------------------------------------- the family shelf */
function PersonAlbum({ member, latest }: { member: Member; latest: Card | undefined }) {
  const photo = memberPhoto(member);
  return (
    <li className="w-[116px] shrink-0" style={{ scrollSnapAlign: "start" }}>
      <Link href={`/people/${member.id}`} className="block text-ink no-underline">
        <div className="relative h-[116px] overflow-hidden rounded-[22px] bg-surface">{photo ? <Photo src={photo} alt={callName(member)} sizes="240px" position="center 30%" /> : <Monogram name={callName(member)} size={116} />}</div>
        <p className="m-0 mt-2 truncate text-[14.5px] font-semibold">{callName(member)}</p>
        <p className="m-0 truncate text-[12.5px] text-ink-soft">{latest ? `${latest.type === "audio" ? "Voice" : "Photo"} · ${ago(latest.takenAt)}` : member.city || placeFromTz(member.tz)}</p>
      </Link>
    </li>
  );
}

/* ----------------------------------------------------------------- page */
export function Courtyard({ onCloseDoor }: { onCloseDoor: () => void }) {
  const { viewer, members } = useViewer();
  const { refreshKey, openRoom } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const elder = viewer.role === "elder";

  const voice = useMemo(() => {
    const others = (cards ?? []).filter((c) => c.type === "audio" && c.authorId && c.authorId !== viewer.id);
    // A voice from the other generation first: that's the one you came for.
    return others.find((c) => members.find((m) => m.id === c.authorId)?.role === (elder ? "adult" : "elder")) ?? others[0];
  }, [cards, viewer.id, members, elder]);
  const people = useMemo(() => peopleByRecency(viewer.id, members, cards ?? []), [viewer.id, members, cards]);
  const latestBy = (id: string) => (cards ?? []).find((c) => c.authorId === id);
  const thisYear = new Date().getFullYear();
  const yearsAgo = (cards ?? []).find((c) => c.type === "photo" && new Date(c.takenAt).getFullYear() < thisYear);

  return (
    <div>
      <header className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-soft">Kutumb · the whole family</p>
            <h1 className="m-0 mt-1 text-[30px] leading-[1.05]">{viewer.firstName}&rsquo;s Aangan</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onCloseDoor} aria-label="Back to the window" className="press grid h-11 w-11 place-items-center rounded-full bg-surface text-ink">
              <Icon name="doorClosed" size={20} />
            </button>
            <button type="button" onClick={() => openRoom("all")} aria-label="Everything, and your settings" className="press rounded-full">
              <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={44} ring />
            </button>
          </div>
        </div>
        <SideSwitch />
      </header>

      <RoomTiles />
      <TodayCard />
      <CourtyardNow />
      {elder && <TodaysRole />}
      <SitTogetherLive />

      {cards === null ? <div className="skeleton mt-5 h-[380px] rounded-[30px]" aria-busy="true" aria-label="Loading" /> : voice ? <VoiceFromHome card={voice} /> : null}

      <ComingUp />

      {yearsAgo && (
        <section aria-label="From the years">
          <SectionTitle href="/lane" linkLabel="Memory Lane">
            From the years
          </SectionTitle>
          <YearsAgo card={yearsAgo} />
        </section>
      )}

      {people.length > 0 && (
        <section aria-label="Your family">
          <SectionTitle href="/bond" linkLabel="Family tree">
            Everyone
          </SectionTitle>
          <ul className="no-scrollbar -mx-5 m-0 flex list-none gap-3 overflow-x-auto px-5 pb-2" style={{ scrollSnapType: "x mandatory", scrollPaddingInline: 20 }}>
            {people.map((m) => (
              <PersonAlbum key={m.id} member={m} latest={latestBy(m.id)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
