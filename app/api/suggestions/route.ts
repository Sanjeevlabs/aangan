import { CreateSuggestionRequestSchema } from "@/lib/schemas";
import { dbAddAgentRun, dbAddSuggestion, dbListSuggestions } from "@/lib/db";
import { runAgent } from "@/lib/agent";
import { agentTools } from "@/lib/agent-tools";

// Agents write suggestions; nothing executes here. Approval happens at
// /api/suggestions/[id]/approve after Review.
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const list =
    status === "pending" || status === "approved" || status === "rejected" || status === "done"
      ? await dbListSuggestions(status)
      : await dbListSuggestions();
  return Response.json({ suggestions: list });
}

export async function POST(req: Request): Promise<Response> {
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
  const result = await runAgent(parsed.data.goal, agentTools());
  const created = [];
  if (result.suggestions.length === 0) {
    created.push(await dbAddSuggestion({ goal: parsed.data.goal, payload: parsed.data.payload }));
  }
  for (const s of result.suggestions) {
    created.push(await dbAddSuggestion({ goal: s.goal, payload: s.payload }));
  }
  await dbAddAgentRun({
    goal: parsed.data.goal,
    tools: result.toolCalls.map((c) => c.name),
    status: result.status,
  });
  return Response.json({ suggestions: created }, { status: 201 });
}
