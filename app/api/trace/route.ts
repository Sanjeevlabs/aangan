import { dbListAgentRuns, dbListSuggestions } from "@/lib/db";
import { serverLedger } from "@/lib/llm-server";
import { requireSession } from "@/lib/auth";
import { listDocs } from "@/lib/family-docs";

// Minimal agent trace: recent runs + suggestions + cumulative spend.
// llm_calls rows mirror to Supabase only in live mode via db helpers;
// the in-memory ledger total is always available.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const [runs, suggestions, museCalls] = await Promise.all([dbListAgentRuns(auth.familyId), dbListSuggestions(undefined, auth.familyId), listDocs(auth.familyId, "muse_call")]);
  return Response.json({
    runs: runs.slice(0, 50),
    suggestions: suggestions.slice(0, 50),
    museCalls: museCalls.slice(0, 60),
    demo: auth.familyId === "demo-family",
    spendTotalUsd: Math.round(serverLedger.total * 100) / 100,
  });
}
