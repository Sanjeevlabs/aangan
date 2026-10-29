"use client";

import { ReelPlayer } from "@/components/reel";
import { RoomHeader } from "@/components/ui/kit";

export default function ReelDetailPage({ params }: { params: { runId: string } }) {
  return (
    <div>
      <RoomHeader title="Birthday reel" subtitle="Every wish, played in order" />
      <ReelPlayer runId={decodeURIComponent(params.runId)} />
    </div>
  );
}
