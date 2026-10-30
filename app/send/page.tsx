"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SendSheet } from "@/components/send-sheet";
import { RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";

// Send something (SPEC §9): Muse's three ideas for someone, from the family's
// connected partners. Opened from a care task, an occasion, or Care in the menu.
function Send() {
  const params = useSearchParams();
  const router = useRouter();
  const { viewer, members } = useViewer();
  // Default: the first grandparent who isn't you.
  const forMemberId = params.get("for") ?? members.find((m) => m.role === "elder" && m.id !== viewer.id)?.id ?? "";
  const title = params.get("title");
  const kind = params.get("kind") === "need" ? "need" : "occasion";
  return (
    <div>
      <RoomHeader title="Send something" />
      {forMemberId && <SendSheet forMemberId={forMemberId} context={title ? { kind, title } : undefined} open onClose={() => router.back()} />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Send />
    </Suspense>
  );
}
