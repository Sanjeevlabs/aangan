"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CareSettings, Knock, Need, Presence, PresenceMoment, Question } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import { MOMENT_LABEL, SHAREABLE, latestFor, quietDay, todayFor } from "@/lib/presence";
import type { Member } from "@/lib/schemas";
import { useDisplayText } from "@/lib/use-display-text";
import { ago, postJson, useJson } from "@/lib/use-json";
import { roomUrl } from "@/lib/overlap";
import { householdName, households, type Household } from "@/lib/households";
import { cn } from "@/lib/utils";
import { dayPartIn, placeFromTz, timeIn } from "@/lib/zones";
import { useShell } from "./shell";
import { Translated } from "./translated";
import { Avatar, Icon, LiveDot, MuseMark } from "./ui/kit";
import { useViewer } from "./viewer";

interface PresenceData {
  presence: Presence[];
  settings: CareSettings[];
}

/** Opening Aangan counts as being in the courtyard (if the person allows it). */
function useVisit(): void {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("aangan:visit")) return;
      sessionStorage.setItem("aangan:visit", "1");
    } catch {
      /* private mode: still fine to post once */
    }
    void postJson("/api/presence", { moment: "here" });
  }, []);
}

/**
 * The top of the courtyard. For children abroad: each parent's day, felt the
 * moment they open the app. For parents: share your day in one tap, answer
 * this week's question, ask for help.
 */
export function CourtyardNow() {
  const { viewer, members } = useViewer();
  const pres = useJson<PresenceData>("/api/presence");
  const sit = useJson<{ knocks: Knock[] }>("/api/sit");
  useVisit();
  const { relationships } = useViewer();
  const farHomes = households(members, relationships).filter((h) => h.elders && !h.members.some((m) => m.id === viewer.id));
  const knocks = (sit.data?.knocks ?? []).filter((k) => k.memberId !== viewer.id);

  return (
    <div className="mt-5 space-y-3">
      {knocks.map((k) => (
        <KnockBanner key={k.id} knock={k} member={members.find((m) => m.id === k.memberId)} />
      ))}
      {viewer.role === "elder" ? (
        <>
          <ShareMyDay presence={pres.data?.presence ?? []} onShared={() => void pres.reload()} />
          <MyQuestions />
          <MyNeeds />
        </>
      ) : (
        farHomes.map((h) => <HomeNow key={h.id} home={h} presence={pres.data?.presence ?? null} settings={pres.data?.settings ?? []} viewerId={viewer.id} />)
      )}
    </div>
  );
}

function KnockBanner({ knock, member }: { knock: Knock; member: Member | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-[#fff6e6] p-3.5">
      <Avatar src={memberPhoto(member)} name={callName(member)} size={44} ring />
      <div className="min-w-0 flex-1">
        <p className="m-0 flex items-center gap-1.5 text-[15px] font-semibold">
          <LiveDot />
          {callName(member)}&rsquo;s door is open
        </p>
        <p className="voice m-0 truncate text-[15px] text-[#8a4b00]">{knock.note || "Come sit with me?"}</p>
      </div>
      <a href={roomUrl(knock.id)} target="_blank" rel="noreferrer" className="press flex h-10 shrink-0 items-center rounded-full bg-black px-4 text-[14px] font-semibold text-white no-underline">
        Come sit
      </a>
    </div>
  );
}

/**
 * One far-away home, right now. Maa and Papa are one card: the home's local
 * time, then each parent's latest moment. A gentle flag only if a parent
 * asked for one, and only for the person they chose.
 */
function HomeNow({ home, presence, settings, viewerId }: { home: Household; presence: Presence[] | null; settings: CareSettings[]; viewerId: string }) {
  const { openAdd } = useShell();
  if (presence === null) return <div className="skeleton h-[96px] rounded-card" aria-busy="true" />;
  const elders = home.members.filter((m) => m.role === "elder");
  const name = householdName(home, (m) => callName(m));
  const rows = elders.map((parent) => {
    const shared = latestFor(parent.id, presence.filter((p) => p.moment !== "here"));
    const visit = latestFor(parent.id, presence.filter((p) => p.moment === "here"));
    const quiet = quietDay(settings.find((x) => x.memberId === parent.id), viewerId, presence, parent.tz);
    const fresh = Boolean(shared && Date.now() - Date.parse(shared.at) < 8 * 3_600_000);
    return { parent, shared, visit, quiet: quiet.quiet, fresh };
  });
  const quiet = rows.filter((r) => r.quiet);

  return (
    <div className={cn("rounded-card p-3.5", quiet.length ? "bg-[#fff6e6]" : "bg-surface")}>
      <Link href="/care" className="flex items-center gap-3 text-ink no-underline">
        <span className="flex shrink-0 -space-x-3">
          {elders.slice(0, 2).map((m) => (
            <Avatar key={m.id} src={memberPhoto(m)} name={callName(m)} size={44} ring />
          ))}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[16px] font-semibold">{quiet.length ? `A quiet day for ${quiet.map((r) => callName(r.parent)).join(" & ")} so far` : `${name}'s ${dayPartIn(home.tz)}`}</p>
          <p className="m-0 truncate text-[13px] text-ink-soft">
            {timeIn(home.tz)} in {placeFromTz(home.tz)}
          </p>
        </div>
        <Icon name="chevron" size={18} className="text-ink-faint" />
      </Link>
      <ul className="m-0 mt-2.5 list-none space-y-1.5 p-0 pl-1">
        {rows.map(({ parent, shared, visit, fresh }) => (
          <li key={parent.id} className="flex items-baseline gap-2 text-[14px]">
            <span className="h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full bg-marigold" aria-hidden="true" />
            <span className="min-w-0 truncate">
              <span className="font-semibold">{callName(parent)}</span>{" "}
              {fresh && shared ? (
                <>
                  {MOMENT_LABEL[shared.moment].line}
                  {shared.note ? <span className="voice text-[15px] text-ink-soft"> · {shared.note}</span> : null}
                  <span className="text-ink-faint"> · {ago(shared.at)}</span>
                </>
              ) : visit ? (
                <span className="text-ink-soft">was in Aangan {ago(visit.at)}</span>
              ) : shared ? (
                <span className="text-ink-soft">
                  {MOMENT_LABEL[shared.moment].line} · {ago(shared.at)}
                </span>
              ) : (
                <span className="text-ink-soft">hasn&rsquo;t shared anything yet</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {quiet.length > 0 && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => openAdd("voice", null, home.members.map((m) => m.id))} className="press h-9 rounded-full bg-black px-3.5 text-[13px] font-semibold text-white">
            Send {name} a voice note
          </button>
        </div>
      )}
    </div>
  );
}

/** For parents: let the family feel your day, one tap at a time. */
function ShareMyDay({ presence, onShared }: { presence: Presence[]; onShared: () => void }) {
  const { viewer } = useViewer();
  const [sent, setSent] = useState<PresenceMoment | null>(null);
  const today = todayFor(viewer.id, presence, viewer.tz).filter((p) => p.moment !== "here");
  const share = async (moment: PresenceMoment) => {
    setSent(moment);
    await postJson("/api/presence", { moment });
    onShared();
    setTimeout(() => setSent(null), 2200);
  };
  return (
    <section aria-label="Share your day" className="rounded-card bg-surface p-4">
      <p className="m-0 text-[17px] font-semibold">{sent ? `Your family will see: ${MOMENT_LABEL[sent].label}` : "Let the family feel your day"}</p>
      <p className="m-0 mt-0.5 text-[13px] text-ink-soft">
        {today.length ? `Shared today: ${today.map((p) => MOMENT_LABEL[p.moment].label).join(", ")}` : "One tap. They'll see it when they open Aangan."}
        {today.length > 0 && (
          <button
            type="button"
            className="ml-2 font-semibold text-ink underline underline-offset-2"
            onClick={async () => {
              await postJson("/api/presence", { presenceId: today[today.length - 1].id }, "DELETE");
              onShared();
            }}
          >
            Undo last
          </button>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SHAREABLE.map((m) => (
          <button key={m} type="button" onClick={() => void share(m)} className={cn("press h-11 rounded-full px-4 text-[15px] font-semibold", sent === m ? "bg-marigold text-black" : "bg-white")}>
            {MOMENT_LABEL[m].label}
          </button>
        ))}
      </div>
    </section>
  );
}

function QuestionLine({ q }: { q: Question }) {
  const { displayLang } = useViewer();
  const { text } = useDisplayText(q.text, q.lang, displayLang);
  return <>{text ?? q.text}</>;
}

/** For elders: this week's question and anything the family asked. */
function MyQuestions() {
  const { viewer, members } = useViewer();
  const { openAdd } = useShell();
  const { data, reload } = useJson<{ questions: Question[] }>("/api/keeper");
  const open = (data?.questions ?? []).filter((q) => q.toMemberId === viewer.id && !q.answeredCardId).slice(0, 2);
  if (open.length === 0) return null;
  return (
    <>
      {open.map((q) => {
        const by = q.askedBy ? members.find((m) => m.id === q.askedBy) : undefined;
        return (
          <section key={q.id} aria-label="A question for you" className="rounded-card bg-[#fff6e6] p-4">
            <p className="m-0 text-[13px] font-medium text-[#8a4b00]">{by ? `${callName(by)} asked you` : "This week's question"}</p>
            <p className="voice m-0 mt-1 text-[20px] leading-snug">
              “<QuestionLine q={q} />”
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              {!by ? <MuseMark>asked by Muse for your family</MuseMark> : <span />}
              <button
                type="button"
                onClick={() =>
                  q.topic === "recipe" && q.askedBy
                    ? openAdd("voice", { kind: "recipe", questionId: q.id, title: q.text.replace(/^How do you make your /i, "").replace(/\?$/, "") })
                    : openAdd("voice", { kind: "answer", questionId: q.id, prompt: q.text })
                }
                className="press flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-black px-4 text-[14px] font-semibold text-white"
              >
                <Icon name="mic" size={16} />
                Answer
              </button>
            </div>
            <div className="mt-1 text-right">
              <button type="button" className="h-9 text-[13px] font-medium text-[#8a4b00]" onClick={async () => { await postJson("/api/keeper", { action: "remove", questionId: q.id }); await reload(); }}>
                {by ? "Not now" : "Skip this one"}
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}

/** For elders: what they asked for, and the reassurance in their language. */
function MyNeeds() {
  const { viewer } = useViewer();
  const { openAdd } = useShell();
  const { data } = useJson<{ needs: Need[] }>("/api/care");
  const mine = (data?.needs ?? []).filter((n) => n.forMemberId === viewer.id && n.status !== "done").slice(0, 2);
  return (
    <section aria-label="Help" className="rounded-card bg-surface p-4">
      {mine.map((n) => (
        <Link key={n.id} href="/care" className="mb-3 block text-ink no-underline">
          <p className="m-0 text-[15px] font-semibold">
            <Translated text={n.title} />
          </p>
          <p className={cn("m-0 text-[14px]", n.noteForParent ? "voice text-[16px]" : "text-ink-soft")}>{n.noteForParent || "Waiting for someone to pick it up."}</p>
        </Link>
      ))}
      <button type="button" onClick={() => openAdd("voice", { kind: "need", forMemberId: viewer.id })} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white">
        <Icon name="mic" size={18} />
        Ask the family for help
      </button>
    </section>
  );
}
