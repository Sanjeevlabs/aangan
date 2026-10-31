"use client";

import { CareView } from "@/components/care-view";
import { Boundary } from "@/components/ui/boundary";

// Care tasks: one shared list for each parent's home.
export default function CarePage() {
  return <Boundary label="Care"><CareView tab="tasks" /></Boundary>;
}
