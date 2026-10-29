import { redirect } from "next/navigation";

// Reels open from Occasions; the bare route goes there.
export default function ReelIndex() {
  redirect("/rituals");
}
