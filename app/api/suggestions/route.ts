import { CreateSuggestionRequestSchema } from "@/lib/schemas";
import { dbAddAgentRun, dbAddSuggestion, dbListSuggestions } from "@/lib/db";
import { runAgent } from "@/lib/agent";
import { agentTools } from "@/lib/agent-tools";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { serverLedger, serverStore } from "@/lib/llm-server";

// Agents write suggestions; nothing executes here. Approval happens at
// /api/suggestions/[id]/approve after Review.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const list = await dbListSuggestions(status === "pending" || status === "approved" || status === "rejected" || status === "done" ? status : undefined, auth.familyId);
  return Response.json({ suggestions: list });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/suggestions")) return Response.json({ error: "rate-limited" }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreateSuggestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-suggestion" }, { status: 400 });
  }
  // Run the agent loop (mock planner or live tool calling) and persist each
  // proposed step as a pending suggestion + trace the run.
  const result = await runAgent(parsed.data.goal, agentTools(auth.familyId), { store: serverStore, ledger: serverLedger });
  const created = [];
  // Only the agent's own proposals are stored. A client-supplied payload is
  // never persisted: approving it would run whatever the client wrote.
  if (result.suggestions.length === 0) {
    created.push(await dbAddSuggestion({ goal: parsed.data.goal, payload: {}, familyId: auth.familyId }));
  }
  for (const s of result.suggestions) {
    created.push(await dbAddSuggestion({ goal: s.goal, payload: s.payload, familyId: auth.familyId }));
  }
  await dbAddAgentRun({
    familyId: auth.familyId,
    goal: parsed.data.goal,
    tools: result.toolCalls.map((c) => c.name),
    status: result.status,
  });
  return Response.json({ suggestions: created }, { status: 201 });
}
