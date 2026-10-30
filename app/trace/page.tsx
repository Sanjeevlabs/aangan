import { notFound } from "next/navigation";
import { TraceView } from "./trace-view";
import { traceVisible } from "./visible";

// What Muse did (SPEC §30.5): hidden in production unless the app runs in mock mode.
export const dynamic = "force-dynamic";

export default function TracePage() {
  if (!traceVisible()) notFound();
  return <TraceView />;
}
