"use client";

import { TogetherPlans } from "@/components/together-plans";
import { Boundary } from "@/components/ui/boundary";

export default function VisitsPage() {
  return <Boundary label="Visits"><TogetherPlans kind="visit" /></Boundary>;
}
