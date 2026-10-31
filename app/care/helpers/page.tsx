"use client";

import { CareView } from "@/components/care-view";
import { Boundary } from "@/components/ui/boundary";

// Local helpers: the grocer, the driver, house help, the plumber.
export default function HelpersPage() {
  return <Boundary label="Helpers"><CareView tab="helpers" /></Boundary>;
}
