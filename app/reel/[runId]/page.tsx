"use client";

import { use } from "react";
import { ReelPlayer } from "@/components/reel";
import { RoomHeader } from "@/components/ui/kit";

export default function ReelDetailPage(props: { params: Promise<{ runId: string }> }) {
  const params = use(props.params);
  return (
    <div>
      <RoomHeader title="Birthday reel" subtitle="Every wish, played in order" />
      <ReelPlayer runId={decodeURIComponent(params.runId)} />
    </div>
  );
}
