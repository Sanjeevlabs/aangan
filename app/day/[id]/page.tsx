"use client";

import { useParams, useRouter } from "next/navigation";
import { PersonDay } from "@/components/person-day";
import { useShell } from "@/components/shell";
import { useViewer } from "@/components/viewer";
import { useFamilyCards } from "@/lib/use-family";

// Someone's day as its own address: /day/<memberId>, or /day/me for your own
// (where you add a photo, a voice, or a line about today). Same viewer the
// family page opens; closing comes back home.
export default function DayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { viewer, members } = useViewer();
  const { refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const who = id === "me" ? viewer : members.find((m) => m.id === id);
  if (!who || cards === null) return <div className="skeleton mt-6 h-[60vh] rounded-[26px]" aria-busy="true" aria-label="Loading" />;
  return <PersonDay member={who} cards={cards} onClose={() => router.push("/")} />;
}
