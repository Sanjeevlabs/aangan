"use client";

import Link from "next/link";
import { useState } from "react";
import { useShell } from "@/components/shell";
import { Avatar, Button, EmptyLine, Icon, Monogram, MuseMark, Photo, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import type { Attempt, Question, Recipe } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import { cn } from "@/lib/utils";
import { postJson, useJson } from "@/lib/use-json";

// The family Kitchen. Not a recipe site: every dish belongs to a person, was
// taught in their voice, and carries everyone who has cooked it since.
export default function KitchenPage() {
  const { viewer, members } = useViewer();
  const { openAdd } = useShell();
  const { data, failed } = useJson<{ recipes: Recipe[]; attempts: Attempt[] }>("/api/kitchen");
  const asks = useJson<{ questions: Question[] }>("/api/keeper");
  const [asking, setAsking] = useState(false);

  const byId = (id: string) => members.find((m) => m.id === id);
  const recipes = data?.recipes ?? [];
  const attemptsFor = (id: string) => (data?.attempts ?? []).filter((a) => a.recipeId === id);
  const waiting = (asks.data?.questions ?? []).filter((q) => q.topic === "recipe" && !q.answeredCardId);
  const mine = waiting.filter((q) => q.toMemberId === viewer.id);
  const hero = recipes[0];
  const heroCook = hero ? byId(hero.cookId) : undefined;

  return (
    <div>
      <RoomHeader title="Kitchen" subtitle="The family's recipes, in the voices that taught them" />

      {mine.length > 0 && (
        <section aria-label="Asked of you" className="mb-6 space-y-2">
          {mine.map((q) => {
            const by = q.askedBy ? byId(q.askedBy) : undefined;
            return (
              <div key={q.id} className="rounded-card bg-[#fff6e6] p-4">
                <p className="m-0 text-[13px] font-medium text-[#8a4b00]">{by ? `${callName(by)} asked you` : "This week's question"}</p>
                <p className="voice m-0 mt-1 text-[20px] leading-snug">“{q.text}”</p>
                <Button className="mt-3 w-full" onClick={() => openAdd("voice", { kind: "recipe", questionId: q.id, title: q.text.replace(/^How do you make your /i, "").replace(/\?$/, "") })}>
                  <Icon name="mic" size={18} />
                  Teach it in your voice
                </Button>
              </div>
            );
          })}
        </section>
      )}

      {data === null && !failed && <div className="skeleton h-[320px] rounded-hero" aria-busy="true" aria-label="Loading recipes" />}
      {failed && <EmptyLine>The Kitchen couldn&rsquo;t load. Try again in a moment.</EmptyLine>}

      {hero && (
        <Link href={`/kitchen/${hero.id}`} className="block text-white no-underline">
          <article className="relative h-[340px] overflow-hidden rounded-hero bg-[#3a2a1c]" style={{ boxShadow: "0 24px 50px -22px rgba(120,70,20,.6)" }}>
            {memberPhoto(heroCook) ? <Photo src={memberPhoto(heroCook) as string} alt={callName(heroCook)} sizes="440px" priority position="center 25%" /> : <div className="absolute inset-0"><Monogram name={callName(heroCook)} size={340} /></div>}
            <div className="glass absolute inset-x-2.5 bottom-2.5 rounded-[22px] p-4">
              <p className="m-0 text-[13px] font-medium text-white/85">From {callName(heroCook)}&rsquo;s hands</p>
              <p className="m-0 mt-0.5 text-[24px] font-bold leading-tight">{hero.title}</p>
              {hero.memory && <p className="voice m-0 mt-1.5 line-clamp-2 text-[17px] leading-snug text-white/90">{hero.memory}</p>}
              <p className="m-0 mt-2.5 text-[13px] text-white/80">{cookedLine(attemptsFor(hero.id), members, viewer.id)}</p>
            </div>
          </article>
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => openAdd("voice", { kind: "recipe" })} className="press flex h-[60px] items-center justify-center gap-2 rounded-[20px] bg-black text-[15px] font-semibold text-white">
          <Icon name="mic" size={18} />
          Teach a recipe
        </button>
        <button type="button" onClick={() => setAsking((v) => !v)} aria-expanded={asking} className={cn("press flex h-[60px] items-center justify-center gap-2 rounded-[20px] text-[15px] font-semibold", asking ? "bg-black/80 text-white" : "bg-surface")}>
          Ask for a recipe
        </button>
      </div>
      {asking && <AskForRecipe onDone={() => { setAsking(false); void asks.reload(); }} />}

      {recipes.length > 0 && (
        <section aria-label="All recipes">
          <SectionTitle>Family recipes</SectionTitle>
          <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
            {recipes.map((r) => {
              const cook = byId(r.cookId);
              return (
                <li key={r.id}>
                  <Link href={`/kitchen/${r.id}`} className="press flex items-center gap-3 py-3 text-ink no-underline">
                    <Avatar src={memberPhoto(cook)} name={callName(cook)} size={52} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">{r.title}</span>
                      <span className="block text-[13px] text-ink-soft">
                        {callName(cook)} · {attemptsFor(r.id).length ? `cooked ${attemptsFor(r.id).length}×` : "not cooked yet"}
                      </span>
                      {r.madeBy === "muse" && <MuseMark>written from {callName(cook)}&rsquo;s voice</MuseMark>}
                    </span>
                    <Icon name="chevron" size={18} className="text-ink-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {waiting.filter((q) => q.toMemberId !== viewer.id).length > 0 && (
        <section aria-label="Waiting on a recipe">
          <SectionTitle>Waiting to be taught</SectionTitle>
          <ul className="m-0 list-none space-y-2 p-0">
            {waiting
              .filter((q) => q.toMemberId !== viewer.id)
              .map((q) => (
                <li key={q.id} className="flex items-center gap-3 rounded-[18px] bg-surface px-3 py-2.5">
                  <Avatar src={memberPhoto(byId(q.toMemberId))} name={callName(byId(q.toMemberId))} size={36} />
                  <span className="voice text-[16px]">“{q.text}”</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {data && recipes.length === 0 && (
        <div className="mt-6 rounded-hero bg-surface px-6 py-10 text-center">
          <p className="m-0 text-[20px] font-semibold">The kitchen is waiting for its first recipe</p>
          <p className="mx-auto mt-2 max-w-[300px] text-[15px] text-ink-soft">Ask the person whose cooking you miss most. They talk; Muse writes the card; you cook it wherever you are.</p>
        </div>
      )}
    </div>
  );
}

function cookedLine(attempts: Attempt[], members: { id: string; displayName: string }[], viewerId: string): string {
  if (attempts.length === 0) return "Nobody has cooked it yet. Be the first.";
  const names = Array.from(new Set(attempts.map((a) => (a.memberId === viewerId ? "you" : members.find((m) => m.id === a.memberId)?.displayName ?? "family"))));
  return `Cooked by ${names.slice(0, 3).join(", ")}`;
}

function AskForRecipe({ onDone }: { onDone: () => void }) {
  const { viewer, members } = useViewer();
  const elders = members.filter((m) => m.id !== viewer.id);
  const [to, setTo] = useState(elders.find((m) => m.role === "elder")?.id ?? elders[0]?.id ?? "");
  const [dish, setDish] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const person = members.find((m) => m.id === to);
  return (
    <div className="mt-3 rounded-card bg-surface p-4">
      {sent ? (
        <p className="m-0 text-[15px]">
          Asked. {sent} will see it at the top of their courtyard, and can answer by voice.
        </p>
      ) : (
        <>
          <p className="m-0 mb-2 text-[13px] font-medium text-ink-soft">Ask</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {elders.map((m) => (
              <button key={m.id} type="button" onClick={() => setTo(m.id)} aria-pressed={to === m.id} className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", to === m.id ? "bg-black text-white" : "bg-white")}>
                <Avatar src={memberPhoto(m)} name={callName(m)} size={34} />
                {callName(m)}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">how they make their…</span>
            <input value={dish} onChange={(e) => setDish(e.target.value)} maxLength={60} placeholder="aloo paratha" className="h-[52px] w-full rounded-full bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold" />
          </label>
          <Button
            className="mt-3 w-full"
            disabled={busy || dish.trim().length < 2 || !to}
            onClick={async () => {
              setBusy(true);
              const out = await postJson("/api/kitchen", { action: "ask", toMemberId: to, dish: dish.trim() });
              setBusy(false);
              if (out) {
                setSent(callName(person));
                setTimeout(onDone, 1800);
              }
            }}
          >
            {busy ? "Asking…" : `Ask ${callName(person)}`}
          </Button>
        </>
      )}
    </div>
  );
}
