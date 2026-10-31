"use client";

import { TogetherPlans } from "@/components/together-plans";
import { Boundary } from "@/components/ui/boundary";

export default function HolidaysPage() {
  return <Boundary label="Holidays"><TogetherPlans kind="holiday" /></Boundary>;
}
