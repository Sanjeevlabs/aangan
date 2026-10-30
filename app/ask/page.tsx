"use client";

import { useEffect, useMemo, useState } from "react";
import { VoiceRow } from "@/components/memory-card";
import { useShell } from "@/components/shell";
import { Avatar, Button, EmptyLine, Icon, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import type { Question } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import { useFamilyCards } from "@/lib/use-family";
import { ago, postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";

// Ask: the heart of Aangan for children and grandchildren. Parents feel
// needed when they're asked for what only they have: their recipe, their
// story, their advice, their blessing. They answer by voice; it goes into the
// family library, and you hear it here.

type Kind = "recipe" | "story" | "wisdom" | "blessing";

const KINDS: { id: Kind; title: string; prompt: string; placeholder: string }[] = [
  { id: "recipe", title: "A recipe", prompt: "Which dish?", placeholder: "The one you make on Sundays" },
  { id: "story", title: "A story", prompt: "About what?", placeholder: "When you were my age" },
  { id: "wisdom", title: "Their advice", prompt: "What would you like their advice on?", placeholder: "How do I stay calm before exams?" },
  { id: "blessing", title: "A blessing", prompt: "For what?", placeholder: "My interview on Friday" },
];

const TOPIC_LABEL: Record<Question["topic"], string> = { recipe: "Recipe", story: "Story", wisdom: "Advice", blessing: "Blessing", song: "Song", place: "Place" };

function KindIcon({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "recipe" && <path d="M4 11h16a8 8 0 0 1-16 0zM8 4c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4M16 4c-1 1.5 1 2.5 0 4" />}
      {kind === "story" && <path d="M19 15.5A8 8 0 1 1 8.5 5a6.5 6.5 0 0 0 10.5 10.5z" />}
      {kind === "wisdom" && <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />}
      {kind === "blessing" && <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />}
    </svg>
  );
}

export default function AskPage() {
  const { viewer, members } = useViewer();
  const { refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const { data, reload } = useJson<{ questions: Question[] }>("/api/keeper");
  const elders = useMemo(() => members.filter((m) => m.role === "elder" && m.id !== viewer.id), [members, viewer.id]);
  const others = useMemo(() => members.filter((m) => m.role !== "elder" && m.role !== "child" && m.id !== viewer.id), [members, viewer.id]);
  const [toId, setToId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!toId && elders[0]) setToId(elders[0].id);
  }, [elders, toId]);
  const to = members.find((m) => m.id === toId);
  const mine = (data?.questions ?? []).filter((q) => q.askedBy === viewer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const waiting = mine.filter((q) => !q.answeredCardId);
  const answered = mine.filter((q) => q.answeredCardId).map((q) => ({ q, card: (cards ?? []).find((c) => c.id === q.answeredCardId) })).filter((x) => x.card);
  const spec = KINDS.find((k) => k.id === kind);

  const send = async () => {
    if (!to || !kind || text.trim().length < 2) return;
    setBusy(true);
    const t = text.trim();
    const out =
      kind === "recipe"
        ? await postJson("/api/kitchen", { action: "ask", toMemberId: to.id, dish: t })
        : kind === "story"
          ? await postJson("/api/stories", { action: "request", toMemberId: to.id, about: t })
          : await postJson("/api/keeper", { action: "ask", toMemberId: to.id, topic: kind, text: kind === "blessing" ? `Will you bless me for ${t}?` : t.endsWith("?") ? t : `${t}?` });
    setBusy(false);
    if (out) {
      setSent(`${callName(to)} will see it on their Home and answer by voice.`);
      setText("");
      setKind(null);
      await reload();
    } else setSent("Couldn't send it. Try again in a moment.");
  };

  return (
    <div>
      <RoomHeader title="Ask" subtitle="What only they can give. They answer by voice." />

      <section aria-label="Who to ask">
        <ul className="no-scrollbar -mx-5 m-0 flex list-none gap-3 overflow-x-auto px-5 p-0">
          {[...elders, ...(more ? others : [])].map((m) => (
            <li key={m.id}>
              <button type="button" aria-pressed={toId === m.id} onClick={() => setToId(m.id)} className="press flex w-[76px] flex-col items-center gap-1.5">
                <span className={cn("rounded-full p-[3px]", toId === m.id ? "bg-ink" : "bg-transparent")}>
                  <Avatar src={memberPhoto(m)} name={callName(m)} size={64} ring />
                </span>
                <span className={cn("max-w-full truncate text-[14px]", toId === m.id ? "font-semibold" : "text-ink-soft")}>{callName(m)}</span>
              </button>
            </li>
          ))}
          {!more && others.length > 0 && (
            <li>
              <button type="button" onClick={() => setMore(true)} className="press flex w-[76px] flex-col items-center gap-1.5">
                <span className="grid h-[70px] w-[70px] place-items-center rounded-full bg-surface text-ink-soft">
                  <Icon name="plus" />
                </span>
                <span className="text-[14px] text-ink-soft">Someone else</span>
              </button>
            </li>
          )}
        </ul>
      </section>

      <section aria-label="What to ask" className="mt-6">
        <h2 className="m-0 mb-3 text-[20px]">Ask {to ? callName(to) : "them"} for</h2>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => {
                setKind(k.id);
                setSent(null);
              }}
              className={cn("press flex h-[92px] flex-col justify-between rounded-card p-4 text-left", kind === k.id ? "bg-ink text-white" : "bg-surface text-ink")}
            >
              <KindIcon kind={k.id} />
              <span className="text-[17px] font-semibold">{k.title}</span>
            </button>
          ))}
        </div>
        {spec && to && (
          <div className="mt-3 rounded-card bg-surface p-4">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-medium">{spec.prompt}</span>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 120))}
                onKeyDown={(e) => e.key === "Enter" && void send()}
                placeholder={spec.placeholder}
                className="h-[52px] w-full rounded-full bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold"
              />
            </label>
            <Button className="mt-3 w-full" disabled={busy || text.trim().length < 2} onClick={() => void send()}>
              {busy ? "Sending…" : `Ask ${callName(to)}`}
            </Button>
          </div>
        )}
        {sent && (
          <p className="m-0 mt-3 text-center text-[14px] text-ink-soft" aria-live="polite">
            {sent}
          </p>
        )}
      </section>

      <section aria-label="Answered" className="mt-10">
        <h2 className="m-0 mb-1 text-[20px]">They answered</h2>
        {data === null ? (
          <div className="skeleton mt-3 h-16" />
        ) : answered.length === 0 ? (
          <EmptyLine>When they answer, you&rsquo;ll hear it here first.</EmptyLine>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {answered.map(({ q, card }) => (
              <div key={q.id}>
                <p className="m-0 pt-3 text-[13px] text-ink-faint">
                  {TOPIC_LABEL[q.topic]} · you asked &ldquo;{q.text}&rdquo;
                </p>
                {card && <VoiceRow card={card} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {waiting.length > 0 && (
        <section aria-label="Waiting" className="mt-8">
          <h2 className="m-0 mb-3 text-[20px]">Waiting for an answer</h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {waiting.map((q) => {
              const who = members.find((m) => m.id === q.toMemberId);
              return (
                <li key={q.id} className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
                  <Avatar src={memberPhoto(who)} name={callName(who)} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{q.text}</span>
                    <span className="block text-[13px] text-ink-soft">
                      {TOPIC_LABEL[q.topic]} · {callName(who)} · {ago(q.createdAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="h-9 shrink-0 text-[13px] font-medium text-ink-soft"
                    onClick={async () => {
                      await postJson("/api/keeper", { action: "remove", questionId: q.id });
                      await reload();
                    }}
                  >
                    Withdraw
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
