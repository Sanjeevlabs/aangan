"use client";

import { CareView } from "@/components/care-view";

// Care tasks: one shared list for each parent's home.
export default function CarePage() {
  return <CareView tab="tasks" />;
}
