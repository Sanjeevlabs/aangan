"use client";

import { ReelPlayer } from "@/components/reel";

export default function ReelDetailPage({ params }: { params: { runId: string } }) {
  const runId = decodeURIComponent(params.runId);
  return (
    <div className="pt-2">
      <h1 className="serif mb-3 mt-0 text-3xl">Birthday Reel</h1>
      <ReelPlayer runId={runId} />
    </div>
  );
}
