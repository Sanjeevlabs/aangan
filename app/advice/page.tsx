"use client";

import Link from "next/link";
import { VoiceRow } from "@/components/memory-card";
import { useShell } from "@/components/shell";
import { Avatar, EmptyLine, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import type { Question } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import { useFamilyCards } from "@/lib/use-family";
import { useJson } from "@/lib/use-json";

// Advice & blessings: the answers parents gave when they were asked, kept
// with the question, by the person who gave them. Recipes and stories have
// their own shelves; this is everything else they know.

export default function AdvicePage() {
  const { viewer, members } = useViewer();
  const { refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const { data } = useJson<{ questions: Question[] }>("/api/keeper");
  const parent = viewer.role === "elder";
  const answered = (data?.questions ?? [])
    .filter((q) => q.answeredCardId && q.topic !== "recipe" && q.topic !== "story")
    .map((q) => ({ q, card: (cards ?? []).find((c) => c.id === q.answeredCardId) }))
    .filter((x) => x.card)
    .sort((a, b) => (b.card?.takenAt ?? "").localeCompare(a.card?.takenAt ?? ""));
  const givers = Array.from(new Set(answered.map((x) => x.q.toMemberId)))
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .sort((a, b) => Number(b.id === viewer.id) - Number(a.id === viewer.id));

  return (
    <div>
      <RoomHeader title="Advice & blessings" subtitle={parent ? "What you told the family when they asked" : "What they told you when you asked, kept for good"} />
      {data === null || cards === null ? (
        <div className="skeleton h-[200px] rounded-card" aria-busy="true" />
      ) : givers.length === 0 ? (
        <div className="rounded-card bg-surface px-5 py-8 text-center">
          <p className="m-0 text-[17px] font-semibold">Nothing here yet</p>
          <p className="m-0 mx-auto mt-1 max-w-[280px] text-[15px] text-ink-soft">{parent ? "When the family asks for your advice or a blessing, your answers live here." : "Ask for their advice or a blessing. Their answer will live here."}</p>
          {!parent && (
            <Link href="/ask" className="press mx-auto mt-4 flex h-12 max-w-[220px] items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white no-underline">
              Ask now
            </Link>
          )}
        </div>
      ) : (
        givers.map((g) => (
          <section key={g.id} aria-label={callName(g)} className="mb-8">
            <h2 className="m-0 mb-1 flex items-center gap-2.5 text-[20px]">
              <Avatar src={memberPhoto(g)} name={callName(g)} size={32} />
              {g.id === viewer.id ? "You" : callName(g)}
            </h2>
            <div className="divide-y divide-[var(--line)]">
              {answered
                .filter((x) => x.q.toMemberId === g.id)
                .map(({ q, card }) => {
                  const by = members.find((m) => m.id === q.askedBy);
                  return (
                    <div key={q.id}>
                      <p className="m-0 pt-3 text-[14px] font-semibold">&ldquo;{q.text}&rdquo;</p>
                      <p className="m-0 text-[12px] text-ink-faint">{q.topic === "blessing" ? "Blessing" : "Advice"}{by ? ` · asked by ${by.id === viewer.id ? "you" : callName(by)}` : " · this week's question"}</p>
                      {card && <VoiceRow card={card} showAuthor={false} />}
                    </div>
                  );
                })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
