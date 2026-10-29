"use client";

import { EmptyLine, RoomHeader } from "@/components/ui/kit";

import { useEffect, useState } from "react";
import { Suggestions } from "@/components/suggestions";
import { useViewer } from "@/components/viewer";

interface Run {
  id: string;
  goal: string;
  tools: string[];
  status: string;
  createdAt: string;
}

interface Suggestion {
  id: string;
  goal: string;
  status: string;
  createdAt: string;
}

// Minimal agent trace page: recent runs + suggestions + spend.
export default function TracePage() {
  const { lang } = useViewer();
  void lang;
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [spend, setSpend] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/trace", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("trace-fetch-failed");
        return r.json();
      })
      .then((data: { runs: Run[]; suggestions: Suggestion[]; spendTotalUsd: number }) => {
        if (!live) return;
        setRuns(data.runs);
        setSuggestions(data.suggestions);
        setSpend(data.spendTotalUsd);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // A transparency view: every step Aangan's agents took, what tools they
  // used, and what it cost. Nothing an agent proposes runs without approval.
  return (
    <div>
      <RoomHeader title="Agent activity" subtitle="What Aangan prepared for your family, and what it cost" />
      <Suggestions />
      <div className="mb-8 flex items-baseline justify-between rounded-[22px] bg-surface px-5 py-4">
        <span className="text-[15px] text-ink-soft">Model spend</span>
        <span className="tnum text-[22px] font-bold">
          ${spend === null ? "…" : spend.toFixed(2)}
          <span className="text-[14px] font-medium text-ink-faint"> / $120 cap</span>
        </span>
      </div>
      <h2 className="m-0 mb-2 text-[20px]">Runs</h2>
      {failed && <EmptyLine>Activity is unavailable offline.</EmptyLine>}
      {runs === null && !failed && <div className="skeleton h-14" aria-busy="true" aria-label="Loading" />}
      {runs !== null && runs.length === 0 && <EmptyLine>No agent runs yet. The daily scan runs each morning.</EmptyLine>}
      <ol className="m-0 list-none p-0">
        {(runs ?? []).map((r) => (
          <li key={r.id} className="border-b border-[var(--line)] py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[16px] font-semibold">{r.goal}</span>
              <span className="tnum shrink-0 text-[13px] text-ink-faint">{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.tools.map((tool) => (
                <span key={tool} className="rounded-full bg-surface px-2.5 py-1 font-mono text-[12px] text-ink-soft">
                  {tool}
                </span>
              ))}
              <span className="rounded-full bg-[#e9f7ef] px-2.5 py-1 text-[12px] font-medium text-[#13653a]">{r.status}</span>
            </div>
          </li>
        ))}
      </ol>
      {suggestions.length > 0 && (
        <>
          <h2 className="m-0 mb-2 mt-9 text-[20px]">Proposals</h2>
          <ul className="m-0 list-none p-0">
            {suggestions.map((sg) => (
              <li key={sg.id} className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-3">
                <span className="text-[15px]">{sg.goal}</span>
                <span className="shrink-0 text-[13px] text-ink-soft">{sg.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
