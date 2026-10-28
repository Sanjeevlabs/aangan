"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RitualRun } from "@/lib/schemas";

export default function ReelListPage() {
  const [runs, setRuns] = useState<RitualRun[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/ritual-runs", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("runs-fetch-failed");
        return r.json();
      })
      .then((data: { runs: RitualRun[] }) => {
        if (live) setRuns(data.runs);
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
      <h1 className="serif mb-3 mt-0 text-3xl">Birthday Reel</h1>
      {failed && (
        <div className="rounded-card border border-line bg-surface p-5" role="alert">
          <p className="m-0 text-[15px]">Couldn’t load reels. Try again.</p>
        </div>
      )}
      {runs === null && !failed && (
        <div aria-busy="true" aria-label="Loading">
          <div className="skeleton mb-2 h-16" />
          <div className="skeleton h-16" />
        </div>
      )}
      {runs !== null && runs.length === 0 && (
        <p className="text-[15px] text-ink-soft">No reels yet — wishes collect in the week before each birthday.</p>
      )}
      <div>
        {(runs ?? []).map((r) => (
          <div key={r.id} className="hairline-row">
            <span className="text-[15px]">
              {r.ritualSlug} · {r.occasionDate} <span className="text-ink-soft">· {r.status}</span>
            </span>
            <Link href={`/reel/${encodeURIComponent(r.id)}`} className="tap shrink-0 text-[15px] font-semibold text-accent">
              Watch
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
