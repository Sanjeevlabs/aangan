"use client";

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

  return (
    <div className="pt-2">
      <h1 className="serif mb-3 mt-0 text-3xl">Agent trace</h1>
      <Suggestions />
      <section aria-label="Spend" className="mb-6">
        <div className="rounded-card border border-line bg-surface px-4 py-3">
          <p className="m-0 text-[15px]">
            Model spend this session: <strong>${spend === null ? "…" : spend.toFixed(2)}</strong> (cap $120)
          </p>
        </div>
      </section>
      <section aria-label="Runs" className="mb-6">
        <h2 className="mb-2 mt-0 text-xl">Recent runs</h2>
        {failed && (
          <p className="text-[15px] text-ink-soft" role="alert">
            Trace unavailable offline.
          </p>
        )}
        {runs === null && !failed && (
          <div aria-busy="true" aria-label="Loading">
            <div className="skeleton mb-2 h-14" />
            <div className="skeleton h-14" />
          </div>
        )}
        {runs !== null && runs.length === 0 && <p className="text-[15px] text-ink-soft">No agent runs yet.</p>}
        <ul className="m-0 list-none p-0">
          {(runs ?? []).map((r) => (
            <li key={r.id} className="hairline-row">
              <span className="text-[14px]">
                {r.goal} <span className="text-ink-soft">· {r.tools.join(", ") || "no tools"} · {r.status}</span>
              </span>
              <span className="shrink-0 text-[12px] text-ink-soft">{r.createdAt.slice(11, 16)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Suggestions log" className="mb-6">
        <h2 className="mb-2 mt-0 text-xl">Suggestions log</h2>
        <ul className="m-0 list-none p-0">
          {suggestions.map((s) => (
            <li key={s.id} className="hairline-row">
              <span className="text-[14px]">{s.goal}</span>
              <span className="shrink-0 text-[12px] text-ink-soft">{s.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
